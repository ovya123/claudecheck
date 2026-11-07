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
from app.models import Activity, Misconception, Parent, Question, QuizResponse, Student
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


@router.get("/parent/overview", response_model=schemas.ParentOverview)
def parent_overview(
    p: Parent = Depends(get_verified_parent),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai),
):
    """The child's classroom, questions, AI answers and activities, translated into the parent's language."""
    child = p.student
    c = child.classroom
    lang = p.language

    questions = db.scalars(select(Question).where(Question.student_id == child.id).order_by(Question.created_at)).all()
    # Batch every text that needs translating into ONE cached AI call.
    to_translate: list[str] = []
    for q in questions:
        if q.language != lang:
            to_translate.append(q.text)
        if q.answer and child.language != lang:
            to_translate.append(q.answer)
    translated = iter(translate_cached(db, ai, to_translate, lang))
    q_views = []
    for q in questions:
        t_text = next(translated) if q.language != lang else q.text
        t_answer = next(translated) if (q.answer and child.language != lang) else q.answer
        q_views.append(schemas.ParentQuestionView(
            id=q.id, original=q.text, original_language=q.language, translated=t_text, answer=t_answer,
            created_at=q.created_at,
        ))

    acts = db.scalars(select(Activity).where(
        Activity.classroom_id == c.id, Activity.status != "draft").order_by(Activity.id)).all()
    answers = {
        r.activity_id: r for r in db.scalars(select(QuizResponse).where(
            QuizResponse.student_id == child.id, QuizResponse.phase == "post")).all()
    }
    loc = lambda d, l: d.get(l) or d.get("en") or next(iter(d.values()), "")  # noqa: E731
    a_views = []
    for a in acts:
        content = a.content.get(lang) or a.content.get("en") or {}
        r = answers.get(a.id)
        a_views.append(schemas.ParentActivityView(
            id=a.id, template=a.template, params=a.params,
            title=content.get("title", ""), explanation=content.get("explanation", ""),
            quiz_question=loc(a.quiz.get("question", {}), lang),
            quiz_options=[loc(o, lang) for o in a.quiz.get("options", [])],
            correct_index=a.quiz.get("correct_index", 0),
            child_answer_index=r.answer_index if r else None, child_correct=r.correct if r else None,
            created_at=a.created_at,
        ))

    return schemas.ParentOverview(
        language=lang, child_name=_child_name(child), child_language=child.language,
        classroom_title=c.title, classroom_topic=c.topic,
        lesson_notes=lesson_notes_in(db, ai, c, lang),
        questions=q_views, activities=a_views,
        stats={
            "questions": len(q_views),
            "activities": len(a_views),
            "activities_done": sum(1 for v in a_views if v.child_correct is not None),
            "correct": sum(1 for v in a_views if v.child_correct),
        },
    )


@router.post("/parent/tips", response_model=schemas.ParentTips)
def parent_tips(
    p: Parent = Depends(get_verified_parent),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai),
):
    """AI-written, practical ways the parent can help at home, in the parent's language."""
    child = p.student
    questions = db.scalars(select(Question).where(Question.student_id == child.id)).all()
    ms = db.scalars(select(Misconception).where(
        Misconception.classroom_id == child.classroom_id, Misconception.status != "dismissed")).all()
    out = ai.parent_tips(
        lesson=lesson_context(child.classroom),
        child_questions=[q.english_translation or q.text for q in questions],
        misconceptions=[m.title for m in ms],
        language=p.language,
    )
    return schemas.ParentTips(language=p.language, **out.model_dump())
