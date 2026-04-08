from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.candidate import router as candidate_router
from app.api.routes.documents import router as documents_router
from app.api.routes.rag import router as rag_router
from app.api.routes.recruiter import router as recruiter_router
from app.api.routes.reports import router as reports_router
from app.api.routes.system import router as system_router

api_router = APIRouter()
api_router.include_router(system_router, tags=["system"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(candidate_router, tags=["candidate"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(rag_router, tags=["rag"])
api_router.include_router(recruiter_router, tags=["recruiter"])
api_router.include_router(reports_router, tags=["reports"])
