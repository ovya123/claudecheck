"""Parent / guardian portal.

Verification flow:
1. The student shares their private family code (shown only to them).
2. The parent links with that code -> a *pending* request (no access to anything yet).
3. The teacher verifies (or rejects) the request on their dashboard.
Only verified parents can see their child's work, translated into the parent's language.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.ai.service import AIService, get_ai
from app.db import get_db
from app.deps import lesson_context
from app.config import SUPPORTED_LANGUAGES
from app.models import Activity, Assignment, Grade, Misconception, Parent, Question, QuizResponse, Student
from app.translation import lesson_notes_in, translate_cached

router = APIRouter(prefix="/api", tags=["parent"])

MAX_PARENTS_PER_STUDENT = 4


def _child_name(s: Student) -> str:
    return s.display_name or "your child"


def _status(p: Parent, token: str | None = None) -> schemas.ParentStatus:
    return schemas.ParentStatus(
        parent_id=p.id, parent_token=token, name=p.name, relation=p.relation, language=p.language,
        status=p.status, child_name=_child_name(p.student), classroom_title=p.student.classroom.title,
    )


def get_parent(
    x_parent_token: str = Header(..., description="Token returned when the parent linked"),
    db: Session = Depends(get_db),
) -> Parent:
    p = db.scalar(select(Parent).where(Parent.token == x_parent_token))
    if p is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown parent token; link again with the family code")
    return p


def get_verified_parent(p: Parent = Depends(get_parent)) -> Parent:
    if p.status != "verified":
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Waiting for the teacher to verify you (status: {p.status})")
    return p


@router.post("/parents/link", response_model=schemas.ParentStatus, status_code=201)
def link_parent(body: schemas.ParentLinkRequest, db: Session = Depends(get_db)):
    """Request access to a child's work using their family code. Starts as *pending*."""
    code = body.family_code.strip().upper().replace("-", "").replace(" ", "")
    student = db.scalar(select(Student).where(Student.family_code == code))
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No student found with that family code")
    active = db.scalar(select(func.count()).select_from(Parent).where(
        Parent.student_id == student.id, Parent.status != "rejected"))
    if (active or 0) >= MAX_PARENTS_PER_STUDENT:
        raise HTTPException(status.HTTP_409_CONFLICT, "This student already has the maximum number of family members linked")
    p = Parent(
        student_id=student.id, classroom_id=student.classroom_id, name=body.name.strip(),
        relation=body.relation.strip() or "Parent", language=body.language,
    )
    db.add(p)
    db.commit()
    return _status(p, token=p.token)


@router.get("/parent/me", response_model=schemas.ParentStatus)
def parent_me(p: Parent = Depends(get_parent)):
    return _status(p)


@router.patch("/parent/me", response_model=schemas.ParentStatus)
def update_parent(body: schemas.ParentUpdate, p: Parent = Depends(get_parent), db: Session = Depends(get_db)):
    p.language = body.language
    db.commit()
    return _status(p)


class _Batch:
    """Collects every text the page needs in the parent's language, then translates them in one cached AI call."""

    def __init__(self, lang: str):
        self.lang = lang
        self.texts: list[str] = []
        self.done: dict[str, str] = {}

    def need(self, text: str, source_lang: str | None) -> str:
        if text and source_lang != self.lang and text not in self.texts:
            self.texts.append(text)
        return text

    def run(self, db: Session, ai: AIService) -> None:
        self.done = dict(zip(self.texts, translate_cached(db, ai, self.texts, self.lang)))

    def __call__(self, text: str) -> str:
        return self.done.get(text, text)


def _loc(d: dict, lang: str) -> str:
    return d.get(lang) or d.get("en") or next(iter(d.values()), "")


@router.get("/parent/overview", response_model=schemas.ParentOverview)
def parent_overview(
    p: Parent = Depends(get_verified_parent),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai),
):
    """The child's classroom, grades, assignments, questions, activities and the class's common mistakes,
    all translated into the parent's language."""
    child = p.student
    c = child.classroom
    lang = p.language
    native = lang in SUPPORTED_LANGUAGES  # mini-lessons were generated in these languages up front
    tr = _Batch(lang)

    # ---- the child's questions + AI answers
    questions = db.scalars(select(Question).where(Question.student_id == child.id).order_by(Question.created_at)).all()
    for q in questions:
        tr.need(q.text, q.language)
        tr.need(q.answer, child.language)

    # ---- shared mini-lessons + the child's quiz answers
    acts = db.scalars(select(Activity).where(Activity.classroom_id == c.id, Activity.status != "draft").order_by(Activity.id)).all()
    answers = {
        r.activity_id: r for r in db.scalars(select(QuizResponse).where(
            QuizResponse.student_id == child.id, QuizResponse.phase == "post")).all()
    }
    src_lang = lang if native else "en"
    for a in acts:
        content = a.content.get(src_lang) or a.content.get("en") or {}
        for t in (content.get("title", ""), content.get("explanation", ""), _loc(a.quiz.get("question", {}), src_lang)):
            tr.need(t, src_lang)
        for o in a.quiz.get("options", []):
            tr.need(_loc(o, src_lang), src_lang)

    # ---- homework / quizzes / tests and the child's grades
    assignments = db.scalars(select(Assignment).where(Assignment.classroom_id == c.id).order_by(Assignment.id)).all()
    grades = {g.assignment_id: g for g in db.scalars(select(Grade).where(Grade.student_id == child.id)).all()}
    for a in assignments:
        tr.need(a.title, c.lesson_language)
        tr.need(a.instructions, c.lesson_language)
        if a.id in grades:
            tr.need(grades[a.id].feedback, c.lesson_language)

    # ---- the class's common mistakes (misconceptions), flagged where the child asked about them
    mistakes = db.scalars(select(Misconception).where(
        Misconception.classroom_id == c.id, Misconception.status != "dismissed").order_by(Misconception.id)).all()
    child_qids = {q.id for q in questions}
    for m in mistakes:
        tr.need(m.title, "en")
        tr.need(m.description, "en")

    tr.run(db, ai)

    q_views = [
        schemas.ParentQuestionView(
            id=q.id, original=q.text, original_language=q.language, translated=tr(q.text), answer=tr(q.answer),
            created_at=q.created_at,
        )
        for q in questions
    ]
    a_views = []
    for a in acts:
        content = a.content.get(src_lang) or a.content.get("en") or {}
        r = answers.get(a.id)
        a_views.append(schemas.ParentActivityView(
            id=a.id, template=a.template, params=a.params,
            title=tr(content.get("title", "")), explanation=tr(content.get("explanation", "")),
            quiz_question=tr(_loc(a.quiz.get("question", {}), src_lang)),
            quiz_options=[tr(_loc(o, src_lang)) for o in a.quiz.get("options", [])],
            correct_index=a.quiz.get("correct_index", 0),
            child_answer_index=r.answer_index if r else None, child_correct=r.correct if r else None,
            created_at=a.created_at,
        ))

    asg_views = []
    by_kind: dict[str, list[float]] = {}
    for a in assignments:
        g = grades.get(a.id)
        score = g.score if g else None
        pct = round(100 * score / a.max_points, 1) if score is not None else None
        if pct is not None:
            by_kind.setdefault(a.kind, []).append(pct)
        asg_views.append(schemas.ParentAssignmentView(
            id=a.id, kind=a.kind, title=tr(a.title), instructions=tr(a.instructions), due_date=a.due_date,
            max_points=a.max_points, score=score, percent=pct, feedback=tr(g.feedback) if g else "",
            created_at=a.created_at,
        ))
    all_pcts = [x for xs in by_kind.values() for x in xs]
    grade_summary: dict[str, float | None] = {k: round(sum(v) / len(v), 1) for k, v in by_kind.items()}
    grade_summary["overall"] = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else None

    mistake_views = [
        schemas.ClassMistakeView(
            id=m.id, title=tr(m.title), description=tr(m.description),
            child_affected=any(i in child_qids for i in m.supporting_question_ids),
        )
        for m in mistakes
    ]
    mistake_views.sort(key=lambda m: not m.child_affected)

    return schemas.ParentOverview(
        language=lang, child_name=_child_name(child), child_language=child.language,
        classroom_title=c.title, classroom_topic=c.topic,
        lesson_notes=lesson_notes_in(db, ai, c, lang),
        questions=q_views, activities=a_views, assignments=asg_views, grade_summary=grade_summary,
        class_mistakes=mistake_views,
        stats={
            "questions": len(q_views),
            "activities": len(a_views),
            "activities_done": sum(1 for v in a_views if v.child_correct is not None),
            "correct": sum(1 for v in a_views if v.child_correct),
            "assignments": len(asg_views),
            "graded": sum(1 for v in asg_views if v.score is not None),
        },
    )


@router.post("/parent/tips", response_model=schemas.ParentTips)
def parent_tips(
    p: Parent = Depends(get_verified_parent),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai),
):
    """The child's weak areas (from grades, teacher feedback, quiz answers and questions) and practical
    ways to help at home, in the parent's language."""
    child = p.student
    questions = db.scalars(select(Question).where(Question.student_id == child.id)).all()
    child_qids = {q.id for q in questions}
    ms = db.scalars(select(Misconception).where(
        Misconception.classroom_id == child.classroom_id, Misconception.status != "dismissed")).all()
    assignments = {a.id: a for a in db.scalars(select(Assignment).where(Assignment.classroom_id == child.classroom_id)).all()}
    grades = db.scalars(select(Grade).where(Grade.student_id == child.id)).all()
    missed = db.scalars(select(QuizResponse).where(
        QuizResponse.student_id == child.id, QuizResponse.phase == "post", QuizResponse.correct.is_(False))).all()
    acts = {a.id: a for a in db.scalars(select(Activity).where(Activity.classroom_id == child.classroom_id)).all()}

    out = ai.parent_tips(
        lesson=lesson_context(child.classroom),
        child_questions=[q.english_translation or q.text for q in questions],
        misconceptions=[
            m.title + (" (this child asked about it)" if any(i in child_qids for i in m.supporting_question_ids) else "")
            for m in ms
        ],
        grades=[
            {
                "kind": assignments[g.assignment_id].kind, "title": assignments[g.assignment_id].title,
                "score": g.score, "max_points": assignments[g.assignment_id].max_points, "teacher_feedback": g.feedback,
            }
            for g in grades if g.assignment_id in assignments
        ],
        missed_quiz_questions=[
            acts[r.activity_id].quiz.get("question", {}).get("en", "") for r in missed if r.activity_id in acts
        ],
        language=p.language,
    )
    return schemas.ParentTips(language=p.language, **out.model_dump())


@router.post("/parent/ui-strings", response_model=list[str])
def translate_ui(body: schemas.UiTranslateRequest, db: Session = Depends(get_db), ai: AIService = Depends(get_ai)):
    """Translate the parent portal's own labels into languages it has no built-in text for (cached)."""
    if body.language == "en":
        return body.texts
    return translate_cached(db, ai, body.texts, body.language)
