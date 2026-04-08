from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.candidate import router as candidate_router
from app.api.routes.system import router as system_router

api_router = APIRouter()
api_router.include_router(system_router, tags=["system"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(candidate_router, tags=["candidate"])
