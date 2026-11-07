"""Offline canned provider for tests and UI development without an API key.

NOT for the demo: the demo must use a real provider (AI_PROVIDER=gemini|openai).
"""

import json
from typing import Any


class MockProvider:
    name = "mock"

    def generate_json(self, task: str, system: str, user: str) -> dict[str, Any]:
        payload = json.loads(user.split("\n\nYour previous reply")[0])
        return getattr(self, f"_{task}")(payload)

    def _answer(self, p: dict) -> dict:
        q = p["question"]
        lang = "hi" if any("ऀ" <= c <= "ॿ" for c in q) else ("fr" if any(
            w in q.lower() for w in ("pourquoi", "est-ce", "une ", "plus")) else "en")
        return {
            "detected_language": lang,
            "english_translation": q if lang == "en" else f"[translated] {q}",
            "concept": "comparing fractions with different denominators",
            "answer": f"[mock answer in {p['answer_language']}] When you cut the same pizza into more "
            "pieces, each piece gets smaller, so 1/8 is smaller than 1/4.",
        }

    def _cluster(self, p: dict) -> dict:
        ids = [q["id"] for q in p["questions"]]
        return {
            "misconceptions": [
                {
                    "title": "Larger denominator means larger fraction",
                    "description": "Students believe a bigger number in the denominator makes the fraction bigger, "
                    "treating the denominator like a whole number instead of the number of equal parts.",
                    "teacher_insight": "Multiple students appear to be struggling with the relationship between "
                    "denominator size and fraction value.",
                    "confidence": 0.9,
                    "supporting_question_ids": ids,
                    "interventions": [
                        {
                            "title": "Pizza-slicing visualization",
                            "description": "Slice the same pizza into 4 and then 8 equal pieces and compare one slice.",
                            "template": "fraction_pizza",
                            "rationale": "Makes 'more pieces = smaller pieces' visible.",
                        }
                    ],
                }
            ],
            "unclustered_question_ids": [],
        }

    def _activity(self, p: dict) -> dict:
        return {
            "template": "fraction_pizza",
            "params": {"denominators": [4, 8], "highlight_slices": 1},
            "content": {
                "en": {"title": "More slices, smaller pieces",
                       "explanation": "Cut the same pizza into 8 pieces instead of 4 and each piece gets smaller.",
                       "interaction_prompt": "Switch between 4 and 8 slices and compare one slice."},
                "hi": {"title": "ज़्यादा टुकड़े, छोटे टुकड़े",
                       "explanation": "एक ही पिज़्ज़ा को 4 की जगह 8 टुकड़ों में काटें, तो हर टुकड़ा छोटा हो जाता है।",
                       "interaction_prompt": "4 और 8 टुकड़ों के बीच बदलें और एक टुकड़े की तुलना करें।"},
                "fr": {"title": "Plus de parts, parts plus petites",
                       "explanation": "Coupe la même pizza en 8 parts au lieu de 4 : chaque part devient plus petite.",
                       "interaction_prompt": "Passe de 4 à 8 parts et compare une part."},
            },
            "quiz": {
                "question": {"en": "Which fraction is larger?", "hi": "कौन-सी भिन्न बड़ी है?",
                             "fr": "Quelle fraction est la plus grande ?"},
                "options": [{"en": "1/6", "hi": "1/6", "fr": "1/6"}, {"en": "1/3", "hi": "1/3", "fr": "1/3"}],
                "correct_index": 1,
                "explanation": {"en": "Thirds are bigger pieces than sixths.",
                                "hi": "तिहाई, छठे भाग से बड़े टुकड़े होते हैं।",
                                "fr": "Les tiers sont plus grands que les sixièmes."},
            },
        }

    def _translate_lesson(self, p: dict) -> dict:
        prefix = "[simplified] " if p["simplified"] else ""
        return {"notes": f"{prefix}[{p['target_language']}] {p['notes']}"}

    def _translate_batch(self, p: dict) -> dict:
        return {"translations": [f"[{p['target_language']}] {t}" for t in p["texts"]]}

    def _parent_tips(self, p: dict) -> dict:
        return {
            "summary": f"[mock {p['language']}] The class is learning about fractions.",
            "tips": ["Cut a roti into 4 and then 8 pieces and compare one piece.", "Share sweets equally."],
            "conversation_starters": ["Which is bigger, 1/4 or 1/8 of a pizza?"],
        }

    def _explain(self, p: dict) -> dict:
        return {"explanation": f"[mock {p['language']}] {p['concept']} explained simply.",
                "example": "Sharing a pizza with friends."}
