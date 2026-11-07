from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "fr": "French",
}


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
