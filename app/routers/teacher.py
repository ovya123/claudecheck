from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import schemas
from app.ai.service import AIService, get_ai
from app.db import get_db
from app.deps import get_teacher_classroom, lesson_context
from app.models import (
    Parent,
    Activity,
    Classroom,
    LessonTranslation,
    Misconception,
    Question,
    QuizResponse,
    Student,
    new_class_code,
)

router = APIRouter(prefix="/api", tags=["teacher"])


# ---------- helpers ----------

def _teacher_question(q: Question) -> schemas.TeacherQuestionOut:
    return schemas.TeacherQuestionOut(
        id=q.id, text=q.text, language=q.language, english_translation=q.english_translation,
        concept=q.concept, created_at=q.created_at,
    )


def _misconception_view(db: Session, m: Misconception) -> schemas.MisconceptionView:
    qs = db.scalars(select(Question).where(Question.id.in_(m.supporting_question_ids or []))).all()
    by_id = {q.id: q for q in qs}
    ordered = [by_id[i] for i in m.supporting_question_ids if i in by_id]
    return schemas.MisconceptionView(
        id=m.id, title=m.title, description=m.description, teacher_insight=m.teacher_insight,
        confidence=m.confidence, status=m.status,
        languages=sorted({q.language for q in ordered}),
        supporting_questions=[_teacher_question(q) for q in ordered],
        interventions=[schemas.InterventionView(**iv) for iv in m.interventions],
        created_at=m.created_at,
    )


def _activity_view(a: Activity) -> schemas.ActivityTeacherView:
    return schemas.ActivityTeacherView(
        id=a.id, misconception_id=a.misconception_id, template=a.template, params=a.params,
        content=a.content, quiz=a.quiz, status=a.status, created_at=a.created_at,
    )


def _phase_stats(responses: list[QuizResponse], n_options: int) -> schemas.PhaseStats:
    counts = [0] * n_options
    for r in responses:
        if 0 <= r.answer_index < n_options:
            counts[r.answer_index] += 1
    correct = sum(r.correct for r in responses)
    pct = round(100 * correct / len(responses), 1) if responses else None
    return schemas.PhaseStats(responses=len(responses), correct=correct, percent_correct=pct, option_counts=counts)


def _results(db: Session, classroom: Classroom, a: Activity) -> schemas.ActivityResults:
    responses = db.scalars(select(QuizResponse).where(QuizResponse.activity_id == a.id)).all()
    n_opts = len(a.quiz.get("options", []))
    pre = _phase_stats([r for r in responses if r.phase == "pre"], n_opts)
    post = _phase_stats([r for r in responses if r.phase == "post"], n_opts)
    improvement = (
        round(post.percent_correct - pre.percent_correct, 1)
        if pre.percent_correct is not None and post.percent_correct is not None else None
    )
    student_count = db.scalar(select(func.count()).select_from(Student).where(Student.classroom_id == classroom.id))
    return schemas.ActivityResults(
        activity_id=a.id, student_count=student_count or 0, pre=pre, post=post,
        improvement_points=improvement,
        needs_more_support=post.percent_correct is not None and post.percent_correct < 70,
    )


def _family_view(p: Parent) -> schemas.FamilyLinkView:
    return schemas.FamilyLinkView(
        id=p.id, name=p.name, relation=p.relation, language=p.language, status=p.status,
        student_id=p.student_id, student_name=p.student.display_name or f"Student {p.student_id}", created_at=p.created_at,
    )


def _families(db: Session, classroom: Classroom) -> list[schemas.FamilyLinkView]:
    ps = db.scalars(select(Parent).where(Parent.classroom_id == classroom.id).order_by(Parent.id)).all()
    return [_family_view(p) for p in ps]


def _get_owned(db: Session, model, obj_id: int, classroom: Classroom):
    obj = db.get(model, obj_id)
    if obj is None or obj.classroom_id != classroom.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} not found")
    return obj


# ---------- classroom ----------

@router.post("/classrooms", response_model=schemas.ClassroomCreated, status_code=201)
def create_classroom(body: schemas.ClassroomCreate, db: Session = Depends(get_db)):
    code = new_class_code()
    while db.scalar(select(Classroom.id).where(Classroom.code == code)):
        code = new_class_code()
    c = Classroom(code=code, **body.model_dump())
    db.add(c)
    db.commit()
    return schemas.ClassroomCreated(id=c.id, code=c.code, title=c.title, teacher_token=c.teacher_token)


@router.get("/teacher/classrooms/{classroom_id}", response_model=schemas.ClassroomTeacher)
def get_classroom(classroom: Classroom = Depends(get_teacher_classroom)):
    return schemas.ClassroomTeacher.model_validate(classroom, from_attributes=True)


@router.put("/teacher/classrooms/{classroom_id}/lesson", response_model=schemas.ClassroomTeacher)
def update_lesson(
    body: schemas.LessonUpdate,
    classroom: Classroom = Depends(get_teacher_classroom),
    db: Session = Depends(get_db),
):
    classroom.lesson_notes = body.lesson_notes
    if body.topic is not None:
        classroom.topic = body.topic
    if body.lesson_language is not None:
        classroom.lesson_language = body.lesson_language
    db.add(classroom)
    db.execute(delete(LessonTranslation).where(LessonTranslation.classroom_id == classroom.id))
    db.commit()
    return schemas.ClassroomTeacher.model_validate(classroom, from_attributes=True)


@router.get("/teacher/classrooms/{classroom_id}/questions", response_model=list[schemas.TeacherQuestionOut])
def list_questions(classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    qs = db.scalars(
        select(Question).where(Question.classroom_id == classroom.id).order_by(Question.created_at.desc())
    ).all()
    return [_teacher_question(q) for q in qs]


# ---------- misconception radar ----------

@router.post("/teacher/classrooms/{classroom_id}/analyze", response_model=schemas.AnalyzeResponse)
def analyze(
    classroom: Classroom = Depends(get_teacher_classroom),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai),
):
    """Run the Cross-Language Misconception Radar over every question in the class.

    Pending (un-reviewed) misconceptions are replaced; approved/dismissed ones are kept, and their
    questions are excluded so the radar surfaces *new* problems.
    """
    reviewed = db.scalars(
        select(Misconception).where(Misconception.classroom_id == classroom.id, Misconception.status != "pending")
    ).all()
    handled_ids = {i for m in reviewed for i in m.supporting_question_ids}
    questions = [
        q for q in db.scalars(select(Question).where(Question.classroom_id == classroom.id)).all()
        if q.id not in handled_ids
    ]
    if not questions:
        raise HTTPException(status.HTTP_409_CONFLICT, "No new student questions to analyze yet")

    result = ai.cluster_questions(
        lesson=lesson_context(classroom),
        questions=[
            {"id": q.id, "language": q.language, "text": q.text, "english_translation": q.english_translation}
            for q in questions
        ],
    )

    db.execute(delete(Misconception).where(
        Misconception.classroom_id == classroom.id, Misconception.status == "pending"))
    created = []
    for m in result.misconceptions:
        row = Misconception(
            classroom_id=classroom.id, title=m.title, description=m.description,
            teacher_insight=m.teacher_insight, confidence=m.confidence,
            supporting_question_ids=m.supporting_question_ids,
            interventions=[iv.model_dump() for iv in m.interventions],
        )
        db.add(row)
        created.append(row)
    db.commit()
    return schemas.AnalyzeResponse(
        analyzed_question_count=len(questions),
        misconceptions=[_misconception_view(db, m) for m in created],
        unclustered_question_ids=result.unclustered_question_ids,
    )


@router.get("/teacher/classrooms/{classroom_id}/misconceptions", response_model=list[schemas.MisconceptionView])
def list_misconceptions(classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    ms = db.scalars(
        select(Misconception).where(Misconception.classroom_id == classroom.id).order_by(Misconception.id)
    ).all()
    return [_misconception_view(db, m) for m in ms]


@router.post(
    "/teacher/classrooms/{classroom_id}/misconceptions/{misconception_id}/approve",
    response_model=schemas.ActivityTeacherView, status_code=201,
)
def approve_intervention(
    misconception_id: int,
    body: schemas.ApproveRequest,
    classroom: Classroom = Depends(get_teacher_classroom),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai),
):
    """Teacher accepts an intervention -> AI generates a multilingual mini-lesson + understanding check."""
    m = _get_owned(db, Misconception, misconception_id, classroom)
    if body.intervention_index >= len(m.interventions):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "intervention_index out of range")
    intervention = m.interventions[body.intervention_index]

    out = ai.generate_activity(
        lesson=lesson_context(classroom),
        misconception={"title": m.title, "description": m.description},
        intervention=intervention,
    )
    activity = Activity(
        classroom_id=classroom.id, misconception_id=m.id, template=out.template, params=out.params,
        content={k: v.model_dump() for k, v in out.content.items()},
        quiz=out.quiz.model_dump(),
        status="draft",  # teacher previews it, then shares it with the class
    )
    m.status = "approved"
    db.add_all([activity, m])
    db.commit()
    return _activity_view(activity)


@router.post(
    "/teacher/classrooms/{classroom_id}/misconceptions/{misconception_id}/dismiss",
    response_model=schemas.MisconceptionView,
)
def dismiss_misconception(
    misconception_id: int,
    classroom: Classroom = Depends(get_teacher_classroom),
    db: Session = Depends(get_db),
):
    m = _get_owned(db, Misconception, misconception_id, classroom)
    m.status = "dismissed"
    db.commit()
    return _misconception_view(db, m)


# ---------- activities & results ----------

@router.get("/teacher/classrooms/{classroom_id}/activities", response_model=list[schemas.ActivityTeacherView])
def list_activities(classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    acts = db.scalars(select(Activity).where(Activity.classroom_id == classroom.id).order_by(Activity.id)).all()
    return [_activity_view(a) for a in acts]


@router.post(
    "/teacher/classrooms/{classroom_id}/activities/{activity_id}/share", response_model=schemas.ActivityTeacherView
)
def share_activity(
    activity_id: int, classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)
):
    """Make a draft mini-lesson visible to students."""
    a = _get_owned(db, Activity, activity_id, classroom)
    a.status = "active"
    db.commit()
    return _activity_view(a)


@router.post(
    "/teacher/classrooms/{classroom_id}/activities/{activity_id}/close", response_model=schemas.ActivityTeacherView
)
def close_activity(
    activity_id: int, classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)
):
    a = _get_owned(db, Activity, activity_id, classroom)
    a.status = "closed"
    db.commit()
    return _activity_view(a)


@router.get(
    "/teacher/classrooms/{classroom_id}/activities/{activity_id}/results", response_model=schemas.ActivityResults
)
def activity_results(
    activity_id: int, classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)
):
    return _results(db, classroom, _get_owned(db, Activity, activity_id, classroom))


# ---------- parent verification ----------

@router.get("/teacher/classrooms/{classroom_id}/parents", response_model=list[schemas.FamilyLinkView])
def list_parents(classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    """Family members who asked to see a student's work. Pending ones need the teacher's verification."""
    return _families(db, classroom)


def _set_parent_status(db: Session, classroom: Classroom, parent_id: int, new_status: str) -> schemas.FamilyLinkView:
    p = _get_owned(db, Parent, parent_id, classroom)
    p.status = new_status
    p.verified_at = datetime.now(timezone.utc) if new_status == "verified" else None
    db.commit()
    return _family_view(p)


@router.post("/teacher/classrooms/{classroom_id}/parents/{parent_id}/verify", response_model=schemas.FamilyLinkView)
def verify_parent(parent_id: int, classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    return _set_parent_status(db, classroom, parent_id, "verified")


@router.post("/teacher/classrooms/{classroom_id}/parents/{parent_id}/reject", response_model=schemas.FamilyLinkView)
def reject_parent(parent_id: int, classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    return _set_parent_status(db, classroom, parent_id, "rejected")


@router.get("/teacher/classrooms/{classroom_id}/dashboard")
def dashboard(classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    """Everything the live teacher dashboard needs in one call (poll this every few seconds)."""
    students = db.scalars(select(Student).where(Student.classroom_id == classroom.id)).all()
    questions = db.scalars(
        select(Question).where(Question.classroom_id == classroom.id).order_by(Question.created_at.desc())
    ).all()
    ms = db.scalars(select(Misconception).where(Misconception.classroom_id == classroom.id)).all()
    acts = db.scalars(select(Activity).where(Activity.classroom_id == classroom.id).order_by(Activity.id)).all()
    return {
        "classroom": schemas.ClassroomTeacher.model_validate(classroom, from_attributes=True),
        "student_count": len(students),
        "students": [
            {"id": s.id, "display_name": s.display_name, "language": s.language, "created_at": s.created_at}
            for s in students
        ],
        "students_by_language": dict(Counter(s.language for s in students)),
        "question_count": len(questions),
        "questions_by_language": dict(Counter(q.language for q in questions)),
        "questions": [_teacher_question(q) for q in questions],
        "misconceptions": [_misconception_view(db, m) for m in ms],
        "activities": [
            {"activity": _activity_view(a), "results": _results(db, classroom, a)} for a in acts
        ],
        "parents": _families(db, classroom),
    }
