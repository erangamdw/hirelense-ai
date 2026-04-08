from app.models.candidate_profile import CandidateProfile
from app.models.chunk import Chunk
from app.db.base_class import Base
from app.models.document import Document
from app.models.recruiter import RecruiterCandidate, RecruiterJob
from app.models.recruiter_profile import RecruiterProfile
from app.models.report import SavedReport
from app.models.user import User

# Import models here as they are added so Alembic can discover metadata.

__all__ = [
    "Base",
    "CandidateProfile",
    "Chunk",
    "Document",
    "RecruiterCandidate",
    "RecruiterJob",
    "RecruiterProfile",
    "SavedReport",
    "User",
]
