from fastapi import APIRouter, Response

from app.core.config import get_settings
from app.core.runtime_checks import build_readiness_checks

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
    }


@router.get("/ready")
def readiness_check(response: Response) -> dict[str, object]:
    settings = get_settings()
    checks = build_readiness_checks()
    is_ready = all(status == "ok" for status in checks.values())
    if not is_ready:
        response.status_code = 503
    return {
        "status": "ready" if is_ready else "degraded",
        "service": settings.app_name,
        "environment": settings.environment,
        "checks": checks,
    }
