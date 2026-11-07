"""High-level AI operations with validated, structured outputs."""

import json
import logging
from functools import lru_cache
from typing import Any, TypeVar

from pydantic import BaseModel, Field, ValidationError

from app.ai import prompts
from app.ai.providers import AIError, Provider, make_provider
from app.config import SUPPORTED_LANGUAGES, get_settings, language_name
from app.templates import template_catalog, validate_template

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


# ---------- structured output schemas ----------

class AnswerOut(BaseModel):
    detected_language: str = "other"
    english_translation: str = ""
    concept: str = ""
    answer: str


class InterventionOut(BaseModel):
    title: str
    description: str
    template: str
    rationale: str = ""


class MisconceptionOut(BaseModel):
    title: str
    description: str
    teacher_insight: str
    confidence: float = Field(default=0.5, ge=0, le=1)
    supporting_question_ids: list[int]
    interventions: list[InterventionOut] = []


class ClusterOut(BaseModel):
    misconceptions: list[MisconceptionOut] = []
    unclustered_question_ids: list[int] = []


class LocalizedContent(BaseModel):
    title: str
    explanation: str
    interaction_prompt: str = ""


class QuizOut(BaseModel):
    question: dict[str, str]
    options: list[dict[str, str]] = Field(min_length=2, max_length=4)
    correct_index: int
    explanation: dict[str, str] = {}


class ActivityOut(BaseModel):
    template: str
    params: dict[str, Any] = {}
    content: dict[str, LocalizedContent]
    quiz: QuizOut


class LessonOut(BaseModel):
    notes: str


class ExplainOut(BaseModel):
    explanation: str
    example: str = ""


class TranslationsOut(BaseModel):
    translations: list[str]


class WeakAreaOut(BaseModel):
    area: str
    evidence: str = ""
    how_to_help: str = ""


class ParentTipsOut(BaseModel):
    summary: str
    weak_areas: list[WeakAreaOut] = []
    tips: list[str] = []
    conversation_starters: list[str] = []


# ---------- service ----------

class AIService:
    def __init__(self, provider: Provider):
        self.provider = provider

    def _call(self, task: str, system: str, payload: dict[str, Any], schema: type[T]) -> T:
        user = json.dumps(payload, ensure_ascii=False, indent=2)
        last_err: Exception | None = None
        for attempt in range(2):
            try:
                data = self.provider.generate_json(task, system, user)
                return schema.model_validate(data)
            except (ValidationError, AIError, ValueError) as e:
                last_err = e
                log.warning("AI task %s attempt %d failed: %s", task, attempt + 1, e)
                user = (
                    json.dumps(payload, ensure_ascii=False, indent=2)
                    + f"\n\nYour previous reply was invalid ({str(e)[:300]}). Return ONLY valid JSON matching the schema."
                )
        raise AIError(f"AI task {task} failed: {last_err}")

    # --- student Q&A ---
    def answer_question(self, *, lesson: dict, question: str, language: str, simpler: bool) -> AnswerOut:
        out = self._call(
            "answer",
            prompts.ANSWER,
            {
                "lesson": lesson,
                "question": question,
                "answer_language": language_name(language),
                "simpler": simpler,
            },
            AnswerOut,
        )
        if out.detected_language not in SUPPORTED_LANGUAGES:
            out.detected_language = "other"
        return out

    # --- misconception radar ---
    def cluster_questions(self, *, lesson: dict, questions: list[dict]) -> ClusterOut:
        out = self._call(
            "cluster",
            prompts.CLUSTER,
            {"lesson": lesson, "template_catalog": template_catalog(), "questions": questions},
            ClusterOut,
        )
        # Guard against hallucinated / duplicated ids.
        valid = {q["id"] for q in questions}
        used: set[int] = set()
        cleaned: list[MisconceptionOut] = []
        for m in out.misconceptions:
            ids = [i for i in dict.fromkeys(m.supporting_question_ids) if i in valid and i not in used]
            if not ids:
                continue
            used.update(ids)
            m.supporting_question_ids = ids
            for iv in m.interventions:
                iv.template, _ = validate_template(iv.template, None)
            cleaned.append(m)
        cleaned.sort(key=lambda m: (len(m.supporting_question_ids), m.confidence), reverse=True)
        out.misconceptions = cleaned
        out.unclustered_question_ids = sorted(valid - used)
        return out

    # --- mini-lesson generator ---
    def generate_activity(self, *, lesson: dict, misconception: dict, intervention: dict) -> ActivityOut:
        langs = list(SUPPORTED_LANGUAGES)
        out = self._call(
            "activity",
            prompts.ACTIVITY,
            {
                "lesson": lesson,
                "misconception": misconception,
                "chosen_intervention": intervention,
                "template": intervention.get("template"),
                "template_catalog": template_catalog(),
                "languages": {code: SUPPORTED_LANGUAGES[code] for code in langs},
            },
            ActivityOut,
        )
        out.template, out.params = validate_template(out.template or intervention.get("template", ""), out.params)
        if not 0 <= out.quiz.correct_index < len(out.quiz.options):
            raise AIError("AI quiz has an out-of-range correct_index")
        # Fill any missing language with English so the frontend never gets a hole.
        fallback = out.content.get("en") or next(iter(out.content.values()))
        for code in langs:
            out.content.setdefault(code, fallback)
            _fill(out.quiz.question, code)
            _fill(out.quiz.explanation, code)
            for opt in out.quiz.options:
                _fill(opt, code)
        return out

    # --- lesson translation / simplification ---
    def translate_lesson(self, *, lesson: dict, target_language: str, simplified: bool) -> str:
        out = self._call(
            "translate_lesson",
            prompts.TRANSLATE_LESSON,
            {
                "source_language": language_name(lesson.get("language", "en")),
                "target_language": language_name(target_language),
                "simplified": simplified,
                "notes": lesson.get("notes", ""),
            },
            LessonOut,
        )
        return out.notes

    # --- parent portal ---
    def translate_texts(self, *, texts: list[str], target_language: str) -> list[str]:
        if not texts:
            return []
        out = self._call(
            "translate_batch",
            prompts.TRANSLATE_BATCH,
            {"target_language": language_name(target_language), "texts": texts},
            TranslationsOut,
        )
        if len(out.translations) != len(texts):
            raise AIError(f"Expected {len(texts)} translations, got {len(out.translations)}")
        return out.translations

    def parent_tips(
        self, *, lesson: dict, child_questions: list[str], misconceptions: list[str], language: str,
        grades: list[dict] | None = None, missed_quiz_questions: list[str] | None = None,
    ) -> ParentTipsOut:
        return self._call(
            "parent_tips",
            prompts.PARENT_TIPS,
            {
                "lesson": lesson,
                "child_questions": child_questions,
                "class_misconceptions": misconceptions,
                "grades": grades or [],
                "missed_quiz_questions": missed_quiz_questions or [],
                "language": language_name(language),
            },
            ParentTipsOut,
        )

    def explain(self, *, lesson: dict, concept: str, language: str, simpler: bool) -> ExplainOut:
        return self._call(
            "explain",
            prompts.EXPLAIN,
            {
                "lesson": lesson,
                "concept": concept,
                "language": language_name(language),
                "simpler": simpler,
            },
            ExplainOut,
        )


def _fill(d: dict[str, str], code: str) -> None:
    if code not in d and d:
        d[code] = d.get("en") or next(iter(d.values()))


@lru_cache
def _default_service() -> AIService:
    return AIService(make_provider(get_settings()))


def get_ai() -> AIService:
    """FastAPI dependency (override in tests)."""
    return _default_service()
