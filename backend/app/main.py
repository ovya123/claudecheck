import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ai.providers import AIError
from app.config import SUPPORTED_LANGUAGES, get_settings
from app.db import init_db
from app.routers import parent, student, teacher
from app.templates import template_catalog

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="ClassBridge API",
    description="Different languages. Different learning speeds. One inclusive classroom.",
    version="1.0.0",
    lifespan=lifespan,
)

_origins = [o.strip() for o in get_settings().cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AIError)
async def ai_error_handler(_: Request, exc: AIError):
    logging.getLogger("classbridge").error("AI failure: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "The AI service failed. Please try again.",
                                                  "error": str(exc)[:500]})


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "ai_provider": get_settings().ai_provider}


@app.get("/api/meta", tags=["meta"])
def meta():
    return {"languages": SUPPORTED_LANGUAGES, "templates": template_catalog()}


app.include_router(teacher.router)
app.include_router(student.router)
app.include_router(parent.router)
