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
from app.schemas.generation import GenerationQueryRequest, GenerationResponse, GroundedPromptType
from app.schemas.retrieval import EvidenceChunkResponse, RetrievalQueryRequest, RetrievalResponse

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
    "EvidenceChunkResponse",
    "GenerationQueryRequest",
    "GenerationResponse",
    "GroundedPromptType",
    "LoginRequest",
    "RetrievalQueryRequest",
    "RetrievalResponse",
    "RegisterRequest",
]
