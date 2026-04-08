from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session
from app.models.report import ReportType
from app.models.user import User
from app.schemas.report import (
    SavedReportCreateRequest,
    SavedReportHistoryResponse,
    SavedReportListItemResponse,
    SavedReportResponse,
)
from app.services.reports import (
    ReportPersistenceError,
    SavedReportNotFoundError,
    create_saved_report,
    get_owned_saved_report,
    list_saved_reports,
)

router = APIRouter(prefix="/reports")


@router.post("", response_model=SavedReportResponse, status_code=status.HTTP_201_CREATED)
def save_report(
    payload: SavedReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> SavedReportResponse:
    try:
        report = create_saved_report(db, user=current_user, payload=payload)
    except ReportPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return SavedReportResponse.model_validate(report)


@router.get("", response_model=SavedReportHistoryResponse)
def list_report_history(
    report_type: ReportType | None = Query(default=None),
    recruiter_job_id: int | None = Query(default=None, ge=1),
    recruiter_candidate_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> SavedReportHistoryResponse:
    try:
        reports = list_saved_reports(
            db,
            user=current_user,
            report_type=report_type,
            recruiter_job_id=recruiter_job_id,
            recruiter_candidate_id=recruiter_candidate_id,
            limit=limit,
        )
    except ReportPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return SavedReportHistoryResponse(
        total=len(reports),
        items=[SavedReportListItemResponse.model_validate(item) for item in reports],
    )


@router.get("/{report_id}", response_model=SavedReportResponse)
def get_report_detail(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> SavedReportResponse:
    try:
        report = get_owned_saved_report(db, user=current_user, report_id=report_id)
    except SavedReportNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return SavedReportResponse.model_validate(report)
