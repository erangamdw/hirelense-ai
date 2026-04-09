from __future__ import annotations

from app.core.config import Settings
from app.core.runtime_checks import StartupCheckError, build_readiness_checks, validate_runtime_settings


def test_validate_runtime_settings_rejects_unsafe_production_defaults() -> None:
    settings = Settings(
        environment="production",
        debug=True,
        enable_docs=True,
        database_url="sqlite:///./hirelense_ai.db",
        jwt_secret_key="change-this-in-production",
        allowed_origins=(),
    )

    try:
        validate_runtime_settings(settings)
    except StartupCheckError as exc:
        message = str(exc)
    else:
        raise AssertionError("validate_runtime_settings should fail for unsafe production defaults.")

    assert "DEBUG must be false in production." in message
    assert "ENABLE_DOCS must be false in production." in message
    assert "JWT_SECRET_KEY must be changed in production." in message
    assert "DATABASE_URL must use PostgreSQL" in message
    assert "ALLOWED_ORIGINS must contain the deployed frontend origin in production." in message


def test_validate_runtime_settings_requires_openai_key_when_openai_is_selected() -> None:
    settings = Settings(
        embedding_provider="openai",
        llm_provider="openai",
        openai_api_key=None,
    )

    try:
        validate_runtime_settings(settings)
    except StartupCheckError as exc:
        message = str(exc)
    else:
        raise AssertionError("validate_runtime_settings should fail when OpenAI providers are selected without a key.")

    assert "OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai." in message
    assert "OPENAI_API_KEY is required when LLM_PROVIDER=openai." in message


def test_build_readiness_checks_reports_expected_dependency_keys() -> None:
    checks = build_readiness_checks()

    assert set(checks) == {"database", "vector_store"}
    assert all(status in {"ok", "failed"} for status in checks.values())
