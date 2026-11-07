import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Classroom, Student


def get_teacher_classroom(
    classroom_id: int,
    x_teacher_token: str = Header(..., description="Token returned when the classroom was created"),
    db: Session = Depends(get_db),
) -> Classroom:
    classroom = db.get(Classroom, classroom_id)
    if classroom is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Classroom not found")
    if not secrets.compare_digest(classroom.teacher_token, x_teacher_token):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid teacher token")
    return classroom


def require_teacher(classroom: Classroom, token: str) -> None:
    if not secrets.compare_digest(classroom.teacher_token, token):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid teacher token")


def get_student(
    x_student_token: str = Header(..., description="Token returned when the student joined"),
    db: Session = Depends(get_db),
) -> Student:
    student = db.scalar(select(Student).where(Student.token == x_student_token))
    if student is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown student token; join the class again")
    return student


def lesson_context(classroom: Classroom) -> dict:
    return {
        "title": classroom.title,
        "topic": classroom.topic,
        "language": classroom.lesson_language,
        "notes": classroom.lesson_notes,
    }
