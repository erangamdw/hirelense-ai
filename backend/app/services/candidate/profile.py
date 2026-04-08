from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candidate_profile import CandidateProfile
from app.models.user import User
from app.schemas.candidate_profile import (
    CandidateDashboardSummary,
    CandidateProfileCreate,
    CandidateProfileUpdate,
)
from app.services.documents import count_documents_for_user


class CandidateProfileExistsError(Exception):
    """Raised when a candidate profile already exists for a user."""


class CandidateProfileNotFoundError(Exception):
    """Raised when a candidate profile does not exist for a user."""


def get_candidate_profile(db: Session, *, user_id: int) -> CandidateProfile | None:
    statement = select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    return db.execute(statement).scalar_one_or_none()


def create_candidate_profile(
    db: Session,
    *,
    user: User,
    payload: CandidateProfileCreate,
) -> CandidateProfile:
    existing_profile = get_candidate_profile(db, user_id=user.id)
    if existing_profile is not None:
        raise CandidateProfileExistsError("Candidate profile already exists for this user.")

    profile = CandidateProfile(
        user_id=user.id,
        headline=payload.headline,
        bio=payload.bio,
        location=payload.location,
        years_experience=payload.years_experience,
        linkedin_url=str(payload.linkedin_url) if payload.linkedin_url else None,
        github_url=str(payload.github_url) if payload.github_url else None,
        portfolio_url=str(payload.portfolio_url) if payload.portfolio_url else None,
        target_roles=payload.target_roles,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_candidate_profile(
    db: Session,
    *,
    user: User,
    payload: CandidateProfileUpdate,
) -> CandidateProfile:
    profile = get_candidate_profile(db, user_id=user.id)
    if profile is None:
        raise CandidateProfileNotFoundError("Candidate profile was not found for this user.")

    profile.headline = payload.headline
    profile.bio = payload.bio
    profile.location = payload.location
    profile.years_experience = payload.years_experience
    profile.linkedin_url = str(payload.linkedin_url) if payload.linkedin_url else None
    profile.github_url = str(payload.github_url) if payload.github_url else None
    profile.portfolio_url = str(payload.portfolio_url) if payload.portfolio_url else None
    profile.target_roles = payload.target_roles

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def build_candidate_dashboard_summary(db: Session, *, user: User) -> CandidateDashboardSummary:
    profile = get_candidate_profile(db, user_id=user.id)
    return CandidateDashboardSummary(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        has_profile=profile is not None,
        target_roles=profile.target_roles if profile is not None else [],
        uploaded_document_count=count_documents_for_user(db, user_id=user.id),
        saved_report_count=0,
        latest_interview_sessions=[],
    )
