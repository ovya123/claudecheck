"""Teacher: homework, quizzes, tests and projects, and the gradebook for each."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import get_teacher_classroom
from app.models import Assignment, Classroom, Grade, Student

router = APIRouter(prefix="/api/teacher/classrooms/{classroom_id}/assignments", tags=["assignments"])


def assignment_view(db: Session, a: Assignment, students: list[Student]) -> schemas.AssignmentView:
    grades = {g.student_id: g for g in db.scalars(select(Grade).where(Grade.assignment_id == a.id)).all()}
    scored = [g.score for g in grades.values() if g.score is not None]
    return schemas.AssignmentView(
        id=a.id, kind=a.kind, title=a.title, instructions=a.instructions, due_date=a.due_date,
        max_points=a.max_points, created_at=a.created_at,
        graded_count=len(scored),
        average_percent=round(100 * sum(scored) / (len(scored) * a.max_points), 1) if scored else None,
        grades=[
            schemas.GradeView(
                student_id=s.id, student_name=s.display_name or f"Student {s.id}",
                score=grades[s.id].score if s.id in grades else None,
                feedback=grades[s.id].feedback if s.id in grades else "",
            )
            for s in students
        ],
    )


def assignment_views(db: Session, classroom: Classroom) -> list[schemas.AssignmentView]:
    students = db.scalars(select(Student).where(Student.classroom_id == classroom.id).order_by(Student.id)).all()
    items = db.scalars(select(Assignment).where(Assignment.classroom_id == classroom.id).order_by(Assignment.id)).all()
    return [assignment_view(db, a, list(students)) for a in items]


def _owned(db: Session, classroom: Classroom, assignment_id: int) -> Assignment:
    a = db.get(Assignment, assignment_id)
    if a is None or a.classroom_id != classroom.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    return a


@router.get("", response_model=list[schemas.AssignmentView])
def list_assignments(classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    return assignment_views(db, classroom)


@router.post("", response_model=schemas.AssignmentView, status_code=201)
def create_assignment(
    body: schemas.AssignmentCreate, classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)
):
    a = Assignment(classroom_id=classroom.id, **body.model_dump())
    db.add(a)
    db.commit()
    students = db.scalars(select(Student).where(Student.classroom_id == classroom.id).order_by(Student.id)).all()
    return assignment_view(db, a, list(students))


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, classroom: Classroom = Depends(get_teacher_classroom), db: Session = Depends(get_db)):
    db.delete(_owned(db, classroom, assignment_id))
    db.commit()


@router.put("/{assignment_id}/grades", response_model=schemas.AssignmentView)
def save_grades(
    assignment_id: int,
    body: list[schemas.GradeIn],
    classroom: Classroom = Depends(get_teacher_classroom),
    db: Session = Depends(get_db),
):
    """Save scores and feedback for any number of students (insert or update)."""
    a = _owned(db, classroom, assignment_id)
    students = db.scalars(select(Student).where(Student.classroom_id == classroom.id).order_by(Student.id)).all()
    valid = {s.id for s in students}
    existing = {g.student_id: g for g in db.scalars(select(Grade).where(Grade.assignment_id == a.id)).all()}
    for g in body:
        if g.student_id not in valid:
            raise HTTPException(422, f"Student {g.student_id} is not in this class")
        if g.score is not None and g.score > a.max_points:
            raise HTTPException(422, f"Score {g.score} is above the maximum of {a.max_points:g}")
        row = existing.get(g.student_id)
        if row is None:
            row = Grade(assignment_id=a.id, student_id=g.student_id)
            db.add(row)
            existing[g.student_id] = row
        row.score = g.score
        row.feedback = g.feedback.strip()
    db.commit()
    return assignment_view(db, a, list(students))
