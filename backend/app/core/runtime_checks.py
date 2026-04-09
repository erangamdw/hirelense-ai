from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, text

from app.core.config import Settings, get_settings
from app.services.rag.vector_store import get_document_collection

DEFAULT_JWT_SECRET = "change-this-in-production"
PRODUCTION_ENVIRONMENTS = {"production", "prod"}


class StartupCheckError(RuntimeError):
    """Raised when the application should not boot with the current configuration."""


def is_production_environment(settings: Settings) -> bool:
    return settings.environment.lower() in PRODUCTION_ENVIRONMENTS


def validate_runtime_settings(settings: Settings) -> None:
    errors: list[str] = []

    if is_production_environment(settings):
        if settings.debug:
            errors.append("DEBUG must be false in production.")
        if settings.enable_docs:
            errors.append("ENABLE_DOCS must be false in production.")
        if settings.jwt_secret_key == DEFAULT_JWT_SECRET:
            errors.append("JWT_SECRET_KEY must be changed in production.")
        if settings.database_url.startswith("sqlite"):
            errors.append("DATABASE_URL must use PostgreSQL or another production database in production.")
        if not settings.allowed_origins:
            errors.append("ALLOWED_ORIGINS must contain the deployed frontend origin in production.")

    if settings.embedding_provider == "openai" and not settings.openai_api_key:
        errors.append("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai.")
    if settings.llm_provider == "openai" and not settings.openai_api_key:
        errors.append("OPENAI_API_KEY is required when LLM_PROVIDER=openai.")

    if errors:
        raise StartupCheckError(" ".join(errors))


def ensure_runtime_directories(settings: Settings) -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.vector_db_path).mkdir(parents=True, exist_ok=True)


def check_database_connection(settings: Settings | None = None) -> None:
    active_settings = settings or get_settings()
    connect_args = {"check_same_thread": False} if active_settings.database_url.startswith("sqlite") else {}
    engine = create_engine(
        active_settings.database_url,
        future=True,
        connect_args=connect_args,
    )
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    finally:
        engine.dispose()


def check_vector_store_connection() -> None:
    get_document_collection()


def run_startup_checks(settings: Settings | None = None) -> None:
    active_settings = settings or get_settings()
    validate_runtime_settings(active_settings)
    ensure_runtime_directories(active_settings)
    check_database_connection(active_settings)
    check_vector_store_connection()


def build_readiness_checks(settings: Settings | None = None) -> dict[str, str]:
    active_settings = settings or get_settings()
    checks: dict[str, str] = {}

    try:
        check_database_connection(active_settings)
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "failed"

    try:
        check_vector_store_connection()
        checks["vector_store"] = "ok"
    except Exception:
        checks["vector_store"] = "failed"

    return checks
