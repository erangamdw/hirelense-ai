from fastapi import APIRouter

from app.core.config import get_settings

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
def readiness_check() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ready",
        "service": settings.app_name,
        "environment": settings.environment,
    }
