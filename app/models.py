import secrets
import string
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

_CODE_ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1IL")


def new_class_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))


def new_family_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


def new_token() -> str:
    return secrets.token_urlsafe(24)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Classroom(Base):
    __tablename__ = "classrooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(12), unique=True, index=True, default=new_class_code)
    title: Mapped[str] = mapped_column(String(200))
    topic: Mapped[str] = mapped_column(String(200), default="")
    lesson_notes: Mapped[str] = mapped_column(Text, default="")
    lesson_language: Mapped[str] = mapped_column(String(8), default="en")
    teacher_token: Mapped[str] = mapped_column(String(64), default=new_token)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    students: Mapped[list["Student"]] = relationship(back_populates="classroom", cascade="all, delete-orphan")
    questions: Mapped[list["Question"]] = relationship(back_populates="classroom", cascade="all, delete-orphan")


class LessonTranslation(Base):
    """Cache of AI-translated (and optionally simplified) lesson notes."""

    __tablename__ = "lesson_translations"
    __table_args__ = (UniqueConstraint("classroom_id", "language", "simplified"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(8))
    simplified: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    language: Mapped[str] = mapped_column(String(8), default="en")
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=new_token)
    # Private code the student gives to a parent/guardian so they can request access.
    family_code: Mapped[str | None] = mapped_column(String(12), unique=True, index=True, nullable=True, default=new_family_code)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    classroom: Mapped[Classroom] = relationship(back_populates="students")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(8))  # detected language of the question
    english_translation: Mapped[str] = mapped_column(Text, default="")
    concept: Mapped[str] = mapped_column(String(200), default="")
    answer: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    classroom: Mapped[Classroom] = relationship(back_populates="questions")


class Misconception(Base):
    __tablename__ = "misconceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    teacher_insight: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    supporting_question_ids: Mapped[list] = mapped_column(JSON, default=list)
    interventions: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | approved | dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Activity(Base):
    """A mini-lesson built on a predefined interactive template, with localized text and a quiz."""

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    misconception_id: Mapped[int | None] = mapped_column(ForeignKey("misconceptions.id"), nullable=True)
    template: Mapped[str] = mapped_column(String(40))
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    content: Mapped[dict] = mapped_column(JSON, default=dict)  # {lang: {title, explanation, interaction_prompt}}
    quiz: Mapped[dict] = mapped_column(JSON, default=dict)  # {question:{lang}, options:[{lang}], correct_index, explanation:{lang}}
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | active (shared) | closed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class QuizResponse(Base):
    __tablename__ = "quiz_responses"
    __table_args__ = (UniqueConstraint("activity_id", "student_id", "phase"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    phase: Mapped[str] = mapped_column(String(8))  # pre | post
    answer_index: Mapped[int] = mapped_column(Integer)
    correct: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Parent(Base):
    """A parent/guardian linked to one student. Must be verified by the teacher before seeing anything."""

    __tablename__ = "parents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    relation: Mapped[str] = mapped_column(String(40), default="Parent")  # Mother, Father, Guardian…
    language: Mapped[str] = mapped_column(String(8), default="en")
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=new_token)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | verified | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    student: Mapped[Student] = relationship()


class TranslationCache(Base):
    """AI translations of short texts (student questions/answers) for parents, keyed by source hash."""

    __tablename__ = "translation_cache"
    __table_args__ = (UniqueConstraint("source_hash", "language"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_hash: Mapped[str] = mapped_column(String(64), index=True)
    language: Mapped[str] = mapped_column(String(8))
    text: Mapped[str] = mapped_column(Text)


class Assignment(Base):
    """Homework, quiz, test or project set by the teacher; graded per student."""

    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16), default="homework")  # homework | quiz | test | project
    title: Mapped[str] = mapped_column(String(200))
    instructions: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    max_points: Mapped[float] = mapped_column(Float, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Grade(Base):
    __tablename__ = "grades"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)  # None = not graded / not handed in
    feedback: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
