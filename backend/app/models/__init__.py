"""Model package placeholder."""
from app.models.candidate_profile import CandidateProfile
from app.models.chunk import Chunk
from app.models.document import Document, DocumentIndexingStatus, DocumentParsingStatus, DocumentType
from app.models.recruiter import RecruiterCandidate, RecruiterJob
from app.models.report import ReportType, SavedReport
from app.models.user import User, UserRole

__all__ = [
    "CandidateProfile",
    "Chunk",
    "Document",
    "DocumentIndexingStatus",
    "DocumentParsingStatus",
    "DocumentType",
    "RecruiterCandidate",
    "RecruiterJob",
    "ReportType",
    "SavedReport",
    "User",
    "UserRole",
]
