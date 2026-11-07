from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "fr": "French",
}


# Parents can read in many more languages than the classroom supports: the AI translates everything for them.
PARENT_LANGUAGES: dict[str, str] = {
    **SUPPORTED_LANGUAGES,
    "es": "Spanish",
    "ar": "Arabic",
    "zh": "Chinese (Simplified)",
    "pa": "Punjabi (Gurmukhi script)",
    "ta": "Tamil",
    "ur": "Urdu",
    "bn": "Bengali",
    "pt": "Portuguese",
    "tl": "Tagalog",
    "vi": "Vietnamese",
    "ko": "Korean",
}


def language_name(code: str) -> str:
    return PARENT_LANGUAGES.get(code, code)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite for local dev; paste the Supabase Postgres connection string for production.
    database_url: str = "sqlite:///./classbridge.db"

    # "gemini" | "openai" | "mock"  (mock = offline canned responses, for tests only)
    ai_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    ai_timeout_seconds: float = 60.0

    # Comma-separated list, e.g. "http://localhost:3000,https://classbridge.vercel.app"
    cors_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()
