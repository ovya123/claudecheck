from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import schemas
from app.ai.service import AIService, get_ai
from app.db import get_db
from app.deps import get_student, lesson_context
from app.models import Activity, Classroom, Parent, Question, QuizResponse, Student, new_family_code
from app.translation import lesson_notes_in

router = APIRouter(prefix="/api", tags=["student"])


def _classroom_by_code(db: Session, code: str) -> Classroom:
    c = db.scalar(select(Classroom).where(Classroom.code == code.strip().upper()))
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No classroom with that code")
    return c


def _public(c: Classroom) -> schemas.ClassroomPublic:
    return schemas.ClassroomPublic(code=c.code, title=c.title, topic=c.topic)


def _loc(d: dict, lang: str) -> str:
    return d.get(lang) or d.get("en") or next(iter(d.values()), "")


# ---------- joining ----------

@router.get("/join/{code}", response_model=schemas.ClassroomPublic)
def preview_classroom(code: str, db: Session = Depends(get_db)):
    return _public(_classroom_by_code(db, code))


@router.post("/join/{code}", response_model=schemas.JoinResponse, status_code=201)
def join_classroom(code: str, body: schemas.JoinRequest, db: Session = Depends(get_db)):
    c = _classroom_by_code(db, code)
    s = Student(classroom_id=c.id, language=body.language, display_name=body.display_name)
    db.add(s)
    db.commit()
    return schemas.JoinResponse(student_id=s.id, student_token=s.token, classroom=_public(c), language=s.language)


@router.patch("/student/me", response_model=schemas.JoinResponse)
def update_me(body: schemas.StudentUpdate, student: Student = Depends(get_student), db: Session = Depends(get_db)):
    student.language = body.language
    db.add(student)
    db.commit()
    return schemas.JoinResponse(
        student_id=student.id, student_token=student.token,
        classroom=_public(student.classroom), language=student.language,
    )


# ---------- lesson ----------

@router.get("/student/lesson", response_model=schemas.LessonView)
def get_lesson(
    simplified: bool = Query(False, description="Return an AI-simplified version"),
    student: Student = Depends(get_student),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai),
):
    """Lesson notes in the student's language (AI-translated, cached per language)."""
    c = student.classroom
    notes = lesson_notes_in(db, ai, c, student.language, simplified)
    return schemas.LessonView(title=c.title, topic=c.topic, language=student.language, simplified=simplified, notes=notes)


# ---------- family (parent access) ----------

@router.get("/student/family", response_model=schemas.StudentFamily)
def my_family(student: Student = Depends(get_student), db: Session = Depends(get_db)):
    """The student's private family code, and who has asked to see their work (and whether verified)."""
    if not student.family_code:
        student.family_code = new_family_code()
        db.commit()
    parents = db.scalars(select(Parent).where(Parent.student_id == student.id).order_by(Parent.id)).all()
    return schemas.StudentFamily(
        family_code=student.family_code,
        parents=[schemas.FamilyLinkView(
            id=p.id, name=p.name, relation=p.relation, language=p.language, status=p.status,
            student_id=student.id, student_name=student.display_name or "", created_at=p.created_at,
        ) for p in parents],
    )


# ---------- private questions ----------

@router.post("/student/questions", response_model=schemas.StudentQuestionOut, status_code=201)
def ask_question(
    body: schemas.QuestionCreate,
    student: Student = Depends(get_student),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai),
):
    """Private question. Stored with its detected language; AI answers in the student's language."""
    c = student.classroom
    out = ai.answer_question(
        lesson=lesson_context(c), question=body.text, language=student.language, simpler=body.simpler
    )
    q = Question(
        classroom_id=c.id, student_id=student.id, text=body.text,
        language=out.detected_language if out.detected_language != "other" else student.language,
        english_translation=out.english_translation, concept=out.concept, answer=out.answer,
    )
    db.add(q)
    db.commit()
    return schemas.StudentQuestionOut(
        id=q.id, text=q.text, language=q.language, answer=q.answer, created_at=q.created_at
    )


@router.get("/student/questions", response_model=list[schemas.StudentQuestionOut])
def my_questions(student: Student = Depends(get_student), db: Session = Depends(get_db)):
    qs = db.scalars(select(Question).where(Question.student_id == student.id).order_by(Question.created_at)).all()
    return [
        schemas.StudentQuestionOut(id=q.id, text=q.text, language=q.language, answer=q.answer, created_at=q.created_at)
        for q in qs
    ]


@router.post("/student/explain", response_model=schemas.ExplainResponse)
def explain(
    body: schemas.ExplainRequest,
    student: Student = Depends(get_student),
    ai: AIService = Depends(get_ai),
):
    out = ai.explain(
        lesson=lesson_context(student.classroom), concept=body.concept,
        language=student.language, simpler=body.simpler,
    )
    return schemas.ExplainResponse(explanation=out.explanation, example=out.example, language=student.language)


# ---------- mini-lessons & understanding checks ----------

@router.get("/student/activities", response_model=list[schemas.ActivityStudentView])
def my_activities(student: Student = Depends(get_student), db: Session = Depends(get_db)):
    """Shared mini-lessons, localized to the student's language (includes the answer key for instant feedback)."""
    acts = db.scalars(select(Activity).where(
        Activity.classroom_id == student.classroom_id, Activity.status == "active"
    ).order_by(Activity.id.desc())).all()
    answered = {
        (r.activity_id, r.phase)
        for r in db.scalars(select(QuizResponse).where(QuizResponse.student_id == student.id)).all()
    }
    lang = student.language
    views = []
    for a in acts:
        content = a.content.get(lang) or a.content.get("en") or {}
        views.append(schemas.ActivityStudentView(
            id=a.id, template=a.template, params=a.params,
            title=content.get("title", ""), explanation=content.get("explanation", ""),
            interaction_prompt=content.get("interaction_prompt", ""),
            quiz_question=_loc(a.quiz.get("question", {}), lang),
            quiz_options=[_loc(o, lang) for o in a.quiz.get("options", [])],
            quiz_correct_index=a.quiz.get("correct_index", 0),
            quiz_explanation=_loc(a.quiz.get("explanation", {}), lang),
            answered_phases=sorted(p for (aid, p) in answered if aid == a.id),
            created_at=a.created_at,
        ))
    return views


@router.post("/student/activities/{activity_id}/responses", response_model=schemas.QuizAnswerResult, status_code=201)
def answer_quiz(
    activity_id: int,
    body: schemas.QuizAnswer,
    student: Student = Depends(get_student),
    db: Session = Depends(get_db),
):
    """Submit an understanding check. phase="pre" before the mini-lesson, "post" after it."""
    a = db.get(Activity, activity_id)
    if a is None or a.classroom_id != student.classroom_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")
    if a.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This activity is not open")
    options = a.quiz.get("options", [])
    if body.answer_index >= len(options):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "answer_index out of range")
    correct_index = a.quiz["correct_index"]
    r = QuizResponse(
        activity_id=a.id, student_id=student.id, phase=body.phase,
        answer_index=body.answer_index, correct=body.answer_index == correct_index,
    )
    db.add(r)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"You already answered the {body.phase} check")
    return schemas.QuizAnswerResult(
        correct=r.correct, correct_index=correct_index,
        explanation=_loc(a.quiz.get("explanation", {}), student.language),
    )
