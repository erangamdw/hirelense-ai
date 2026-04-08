"""Schema package placeholder."""
from app.schemas.auth import AuthResponse, CurrentUserResponse, LoginRequest, RegisterRequest
from app.schemas.candidate_profile import (
    CandidateDashboardSummary,
    CandidateProfileCreate,
    CandidateProfileResponse,
    CandidateProfileUpdate,
)

__all__ = [
    "AuthResponse",
    "CandidateDashboardSummary",
    "CandidateProfileCreate",
    "CandidateProfileResponse",
    "CandidateProfileUpdate",
    "CurrentUserResponse",
    "LoginRequest",
    "RegisterRequest",
]
