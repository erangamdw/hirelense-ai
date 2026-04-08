from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_candidate, get_db_session
from app.models.user import User
from app.schemas.candidate_profile import (
    CandidateDashboardSummary,
    CandidateProfileCreate,
    CandidateProfileResponse,
    CandidateProfileUpdate,
)
from app.services.candidate import (
    CandidateProfileExistsError,
    CandidateProfileNotFoundError,
    build_candidate_dashboard_summary,
    create_candidate_profile,
    get_candidate_profile,
    update_candidate_profile,
)

router = APIRouter(prefix="/candidate")


@router.post(
    "/profile",
    response_model=CandidateProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(
    payload: CandidateProfileCreate,
    current_user: User = Depends(get_current_candidate),
    db: Session = Depends(get_db_session),
) -> CandidateProfileResponse:
    try:
        profile = create_candidate_profile(db, user=current_user, payload=payload)
    except CandidateProfileExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return CandidateProfileResponse.model_validate(profile)


@router.get("/profile", response_model=CandidateProfileResponse)
def read_profile(
    current_user: User = Depends(get_current_candidate),
    db: Session = Depends(get_db_session),
) -> CandidateProfileResponse:
    profile = get_candidate_profile(db, user_id=current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile was not found for this user.",
        )

    return CandidateProfileResponse.model_validate(profile)


@router.put("/profile", response_model=CandidateProfileResponse)
def update_profile(
    payload: CandidateProfileUpdate,
    current_user: User = Depends(get_current_candidate),
    db: Session = Depends(get_db_session),
) -> CandidateProfileResponse:
    try:
        profile = update_candidate_profile(db, user=current_user, payload=payload)
    except CandidateProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return CandidateProfileResponse.model_validate(profile)


@router.get("/dashboard", response_model=CandidateDashboardSummary)
def read_dashboard(
    current_user: User = Depends(get_current_candidate),
    db: Session = Depends(get_db_session),
) -> CandidateDashboardSummary:
    return build_candidate_dashboard_summary(db, user=current_user)
