from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User
from app.schemas.recruiter_profile import RecruiterProfileCreate, RecruiterProfileUpdate


class RecruiterProfileExistsError(Exception):
    """Raised when a recruiter profile already exists for a user."""


class RecruiterProfileNotFoundError(Exception):
    """Raised when a recruiter profile does not exist for a user."""


def get_recruiter_profile(db: Session, *, user_id: int) -> RecruiterProfile | None:
    statement = select(RecruiterProfile).where(RecruiterProfile.user_id == user_id)
    return db.execute(statement).scalar_one_or_none()


def create_recruiter_profile(
    db: Session,
    *,
    user: User,
    payload: RecruiterProfileCreate,
) -> RecruiterProfile:
    existing_profile = get_recruiter_profile(db, user_id=user.id)
    if existing_profile is not None:
        raise RecruiterProfileExistsError("Recruiter profile already exists for this user.")

    profile = RecruiterProfile(
        user_id=user.id,
        company_name=payload.company_name,
        recruiter_type=payload.recruiter_type.value,
        organisation_size=payload.organisation_size,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_recruiter_profile(
    db: Session,
    *,
    user: User,
    payload: RecruiterProfileUpdate,
) -> RecruiterProfile:
    profile = get_recruiter_profile(db, user_id=user.id)
    if profile is None:
        raise RecruiterProfileNotFoundError("Recruiter profile was not found for this user.")

    profile.company_name = payload.company_name
    profile.recruiter_type = payload.recruiter_type.value
    profile.organisation_size = payload.organisation_size
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
