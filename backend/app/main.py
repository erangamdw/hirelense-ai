from contextlib import asynccontextmanager
import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.runtime_checks import run_startup_checks

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        run_startup_checks(settings)
        yield

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url="/redoc" if settings.enable_docs else None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
        lifespan=lifespan,
    )
    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.allowed_origins),
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        request_id = uuid4().hex[:12]
        started_at = perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (perf_counter() - started_at) * 1000
            logger.exception(
                "Request failed: %s %s request_id=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                request_id,
                duration_ms,
            )
            raise

        duration_ms = (perf_counter() - started_at) * 1000
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "Request completed: %s %s -> %s request_id=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            request_id,
            duration_ms,
        )
        return response

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
