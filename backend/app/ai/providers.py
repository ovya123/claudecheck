"""LLM providers. Each returns a parsed JSON object for a (system, user) prompt pair."""

import json
import logging
import re
from typing import Any, Protocol

import httpx

from app.config import Settings

log = logging.getLogger(__name__)


class AIError(RuntimeError):
    pass


class Provider(Protocol):
    name: str

    def generate_json(self, task: str, system: str, user: str) -> dict[str, Any]: ...


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_json(text: str) -> dict[str, Any]:
    text = _FENCE_RE.sub("", text.strip()).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Last resort: grab the outermost {...}
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise AIError("Model did not return JSON")
        data = json.loads(text[start : end + 1])
    if not isinstance(data, dict):
        raise AIError("Model returned JSON that is not an object")
    return data


class GeminiProvider:
    name = "gemini"

    def __init__(self, settings: Settings):
        if not settings.gemini_api_key:
            raise AIError("GEMINI_API_KEY is not set")
        self.key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.client = httpx.Client(timeout=settings.ai_timeout_seconds)

    def generate_json(self, task: str, system: str, user: str) -> dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.3},
        }
        r = self.client.post(url, json=body, headers={"x-goog-api-key": self.key})
        if r.status_code >= 400:
            raise AIError(f"Gemini error {r.status_code}: {r.text[:300]}")
        try:
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise AIError(f"Unexpected Gemini response: {r.text[:300]}") from e
        return parse_json(text)


class OpenAIProvider:
    name = "openai"

    def __init__(self, settings: Settings):
        if not settings.openai_api_key:
            raise AIError("OPENAI_API_KEY is not set")
        self.key = settings.openai_api_key
        self.model = settings.openai_model
        self.client = httpx.Client(timeout=settings.ai_timeout_seconds)

    def generate_json(self, task: str, system: str, user: str) -> dict[str, Any]:
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"},
        }
        r = self.client.post(
            "https://api.openai.com/v1/chat/completions",
            json=body,
            headers={"Authorization": f"Bearer {self.key}"},
        )
        if r.status_code >= 400:
            raise AIError(f"OpenAI error {r.status_code}: {r.text[:300]}")
        try:
            text = r.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise AIError(f"Unexpected OpenAI response: {r.text[:300]}") from e
        return parse_json(text)


def make_provider(settings: Settings) -> Provider:
    name = settings.ai_provider.lower()
    if name == "gemini":
        return GeminiProvider(settings)
    if name == "openai":
        return OpenAIProvider(settings)
    if name == "mock":
        from app.ai.mock import MockProvider

        log.warning("Using MOCK AI provider: responses are canned, not real AI analysis.")
        return MockProvider()
    raise AIError(f"Unknown AI_PROVIDER {settings.ai_provider!r}")
