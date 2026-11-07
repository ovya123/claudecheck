from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.config import SUPPORTED_LANGUAGES

LangCode = Literal["en", "hi", "fr"]


# ---------- requests ----------

class ClassroomCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200, examples=["Introduction to Fractions"])
    topic: str = Field(default="", max_length=200, examples=["Fractions"])
    lesson_notes: str = Field(default="", max_length=20_000)
    lesson_language: LangCode = "en"


class LessonUpdate(BaseModel):
    topic: str | None = Field(default=None, max_length=200)
    lesson_notes: str = Field(max_length=20_000)
    lesson_language: LangCode | None = None


class JoinRequest(BaseModel):
    language: LangCode = "en"
    display_name: str | None = Field(default=None, max_length=80)


class StudentUpdate(BaseModel):
    language: LangCode


class QuestionCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    simpler: bool = False


class ExplainRequest(BaseModel):
    concept: str = Field(min_length=1, max_length=500, examples=["Why is 1/8 smaller than 1/4?"])
    simpler: bool = False


class ApproveRequest(BaseModel):
    intervention_index: int = Field(default=0, ge=0)


class QuizAnswer(BaseModel):
    answer_index: int = Field(ge=0)
    phase: Literal["pre", "post"] = "post"


# ---------- responses ----------

class ClassroomCreated(BaseModel):
    id: int
    code: str
    title: str
    teacher_token: str


class ClassroomPublic(BaseModel):
    code: str
    title: str
    topic: str
    languages: dict[str, str] = SUPPORTED_LANGUAGES


class ClassroomTeacher(BaseModel):
    id: int
    code: str
    title: str
    topic: str
    lesson_notes: str
    lesson_language: str
    created_at: datetime


class JoinResponse(BaseModel):
    student_id: int
    student_token: str
    classroom: ClassroomPublic
    language: str


class StudentQuestionOut(BaseModel):
    id: int
    text: str
    language: str
    answer: str
    created_at: datetime


class TeacherQuestionOut(BaseModel):
    """Anonymous: never exposes which student asked."""

    id: int
    text: str
    language: str
    english_translation: str
    concept: str
    created_at: datetime


class InterventionView(BaseModel):
    title: str
    description: str
    template: str
    rationale: str = ""


class MisconceptionView(BaseModel):
    id: int
    title: str
    description: str
    teacher_insight: str
    confidence: float
    status: str
    languages: list[str]
    supporting_questions: list[TeacherQuestionOut]
    interventions: list[InterventionView]
    created_at: datetime


class AnalyzeResponse(BaseModel):
    analyzed_question_count: int
    misconceptions: list[MisconceptionView]
    unclustered_question_ids: list[int]


class ActivityTeacherView(BaseModel):
    id: int
    misconception_id: int | None
    template: str
    params: dict[str, Any]
    content: dict[str, Any]
    quiz: dict[str, Any]
    status: str
    created_at: datetime


class ActivityStudentView(BaseModel):
    id: int
    template: str
    params: dict[str, Any]
    title: str
    explanation: str
    interaction_prompt: str
    quiz_question: str
    quiz_options: list[str]
    quiz_correct_index: int
    quiz_explanation: str
    answered_phases: list[str]
    created_at: datetime


class QuizAnswerResult(BaseModel):
    correct: bool
    correct_index: int
    explanation: str


class PhaseStats(BaseModel):
    responses: int
    correct: int
    percent_correct: float | None
    option_counts: list[int]


class ActivityResults(BaseModel):
    activity_id: int
    student_count: int
    pre: PhaseStats
    post: PhaseStats
    improvement_points: float | None = Field(description="post % correct minus pre % correct")
    needs_more_support: bool


class ExplainResponse(BaseModel):
    explanation: str
    example: str
    language: str


class LessonView(BaseModel):
    title: str
    topic: str
    language: str
    simplified: bool
    notes: str
