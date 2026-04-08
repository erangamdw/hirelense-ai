"""Schema package placeholder."""
from app.schemas.auth import AuthResponse, CurrentUserResponse, LoginRequest, RegisterRequest
from app.schemas.candidate_profile import (
    CandidateDashboardSummary,
    CandidateProfileCreate,
    CandidateProfileResponse,
    CandidateProfileUpdate,
)
from app.schemas.document import (
    ChunkResponse,
    DocumentChunkingResponse,
    DocumentIndexingResponse,
    DocumentResponse,
)

__all__ = [
    "AuthResponse",
    "CandidateDashboardSummary",
    "CandidateProfileCreate",
    "CandidateProfileResponse",
    "CandidateProfileUpdate",
    "ChunkResponse",
    "CurrentUserResponse",
    "DocumentChunkingResponse",
    "DocumentIndexingResponse",
    "DocumentResponse",
    "LoginRequest",
    "RegisterRequest",
]
