from app.models.candidate_profile import CandidateProfile
from app.db.base_class import Base
from app.models.user import User

# Import models here as they are added so Alembic can discover metadata.

__all__ = ["Base", "CandidateProfile", "User"]
