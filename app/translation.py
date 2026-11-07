"""Cached AI translation helpers shared by the student and parent portals."""

import hashlib

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai.service import AIService
from app.deps import lesson_context
from app.models import Classroom, LessonTranslation, TranslationCache


def lesson_notes_in(db: Session, ai: AIService, classroom: Classroom, lang: str, simplified: bool = False) -> str:
    """Lesson notes in `lang` (optionally simplified), translated once and cached."""
    if not classroom.lesson_notes.strip():
        return ""
    if lang == classroom.lesson_language and not simplified:
        return classroom.lesson_notes
    cached = db.scalar(select(LessonTranslation).where(
        LessonTranslation.classroom_id == classroom.id,
        LessonTranslation.language == lang,
        LessonTranslation.simplified == simplified,
    ))
    if cached:
        return cached.notes
    notes = ai.translate_lesson(lesson=lesson_context(classroom), target_language=lang, simplified=simplified)
    db.add(LessonTranslation(classroom_id=classroom.id, language=lang, simplified=simplified, notes=notes))
    try:
        db.commit()
    except IntegrityError:  # another request cached it concurrently
        db.rollback()
    return notes


def _key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def translate_cached(db: Session, ai: AIService, texts: list[str], lang: str) -> list[str]:
    """Translate many short texts into `lang` with one AI call; each text is cached forever after."""
    out: list[str | None] = [None] * len(texts)
    keys = [_key(t) for t in texts]
    if keys:
        rows = db.scalars(select(TranslationCache).where(
            TranslationCache.language == lang, TranslationCache.source_hash.in_(set(keys))
        )).all()
        hits = {r.source_hash: r.text for r in rows}
        for i, k in enumerate(keys):
            if not texts[i].strip():
                out[i] = texts[i]
            elif k in hits:
                out[i] = hits[k]

    missing = sorted({i for i, v in enumerate(out) if v is None}, key=lambda i: i)
    unique: dict[str, int] = {}
    for i in missing:
        unique.setdefault(keys[i], i)
    if unique:
        sources = [texts[i] for i in unique.values()]
        translated = ai.translate_texts(texts=sources, target_language=lang)
        by_key = dict(zip(unique.keys(), translated))
        for k, t in by_key.items():
            db.add(TranslationCache(source_hash=k, language=lang, text=t))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
        for i in missing:
            out[i] = by_key[keys[i]]
    return [t or "" for t in out]
