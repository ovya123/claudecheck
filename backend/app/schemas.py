from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.config import PARENT_LANGUAGES, SUPPORTED_LANGUAGES

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


# ---------- parent portal ----------

def _parent_lang(v: str) -> str:
    if v not in PARENT_LANGUAGES:
        raise ValueError(f"language must be one of {sorted(PARENT_LANGUAGES)}")
    return v


class ParentLinkRequest(BaseModel):
    family_code: str = Field(min_length=4, max_length=12, examples=["K7MP2QXA"])
    name: str = Field(min_length=1, max_length=80, examples=["Sunita"])
    relation: str = Field(default="Parent", max_length=40, examples=["Mother"])
    language: str = Field(default="en", description="Any code from GET /api/meta parent_languages")

    _lang = field_validator("language")(_parent_lang)


class ParentUpdate(BaseModel):
    language: str

    _lang = field_validator("language")(_parent_lang)


class UiTranslateRequest(BaseModel):
    language: str
    texts: list[str] = Field(max_length=120)

    _lang = field_validator("language")(_parent_lang)

    @field_validator("texts")
    @classmethod
    def _short(cls, v: list[str]) -> list[str]:
        if any(len(t) > 400 for t in v):
            raise ValueError("each text must be at most 400 characters")
        return v


class ParentStatus(BaseModel):
    parent_id: int
    parent_token: str | None = None  # only returned once, when linking
    name: str
    relation: str
    language: str
    status: str  # pending | verified | rejected
    child_name: str
    classroom_title: str


class ParentQuestionView(BaseModel):
    id: int
    original: str
    original_language: str
    translated: str
    answer: str
    created_at: datetime


class ParentActivityView(BaseModel):
    id: int
    template: str
    params: dict[str, Any]
    title: str
    explanation: str
    quiz_question: str
    quiz_options: list[str]
    correct_index: int
    child_answer_index: int | None
    child_correct: bool | None
    created_at: datetime


class ParentAssignmentView(BaseModel):
    id: int
    kind: str
    title: str
    instructions: str
    due_date: str | None
    max_points: float
    score: float | None
    percent: float | None
    feedback: str
    created_at: datetime


class ClassMistakeView(BaseModel):
    id: int
    title: str
    description: str
    child_affected: bool  # the child asked a question reflecting this misconception


class ParentOverview(BaseModel):
    language: str
    child_name: str
    child_language: str
    classroom_title: str
    classroom_topic: str
    lesson_notes: str
    questions: list[ParentQuestionView]
    activities: list[ParentActivityView]
    assignments: list[ParentAssignmentView]
    grade_summary: dict[str, float | None]  # average % per kind + "overall"
    class_mistakes: list[ClassMistakeView]
    stats: dict[str, int]


class WeakArea(BaseModel):
    area: str
    evidence: str = ""
    how_to_help: str = ""


class ParentTips(BaseModel):
    language: str
    summary: str
    weak_areas: list[WeakArea] = []
    tips: list[str]
    conversation_starters: list[str]


class FamilyLinkView(BaseModel):
    """A parent link as the teacher (or the student) sees it."""

    id: int
    name: str
    relation: str
    language: str
    status: str
    student_id: int
    student_name: str
    created_at: datetime


class StudentFamily(BaseModel):
    family_code: str
    parents: list[FamilyLinkView]


# ---------- assignments & grades (teacher) ----------

AssignmentKind = Literal["homework", "quiz", "test", "project"]


class AssignmentCreate(BaseModel):
    kind: AssignmentKind = "homework"
    title: str = Field(min_length=1, max_length=200, examples=["Fractions worksheet 1"])
    instructions: str = Field(default="", max_length=10_000)
    due_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$", examples=["2026-11-14"])
    max_points: float = Field(default=10, gt=0, le=1000)


class GradeIn(BaseModel):
    student_id: int
    score: float | None = Field(default=None, ge=0)
    feedback: str = Field(default="", max_length=2000)


class GradeView(BaseModel):
    student_id: int
    student_name: str
    score: float | None
    feedback: str


class AssignmentView(BaseModel):
    id: int
    kind: str
    title: str
    instructions: str
    due_date: str | None
    max_points: float
    created_at: datetime
    graded_count: int
    average_percent: float | None
    grades: list[GradeView]
