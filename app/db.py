from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _normalize_url(url: str) -> str:
    # Supabase hands out "postgresql://" / "postgres://" URLs; use the psycopg 3 driver.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def make_engine(url: str):
    url = _normalize_url(url)
    kwargs = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401  (register tables)

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """Tiny migration for databases created before the parent feature (create_all never alters tables)."""
    from sqlalchemy import inspect, select, text, update

    from app.models import Student, new_family_code

    cols = {c["name"] for c in inspect(engine).get_columns("students")}
    if "family_code" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE students ADD COLUMN family_code VARCHAR(12)"))
        for (sid,) in conn.execute(select(Student.id)).all():
            conn.execute(update(Student).where(Student.id == sid).values(family_code=new_family_code()))
