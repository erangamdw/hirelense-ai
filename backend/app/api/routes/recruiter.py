from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_recruiter, get_db_session
from app.models.document import DocumentType
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.schemas.recruiter import (
    RecruiterCandidateIntakeCreate,
    RecruiterCandidateResponse,
    RecruiterCandidateStatusUpdate,
    RecruiterJobCreate,
    RecruiterJobDetailResponse,
    RecruiterJobListResponse,
    RecruiterJobUpdate,
)
from app.schemas.recruiter_profile import (
    RecruiterProfileCreate,
    RecruiterProfileResponse,
    RecruiterProfileUpdate,
)
from app.schemas.recruiter_dashboard import (
    RecruiterCandidateComparisonResponse,
    RecruiterCandidateReviewResponse,
    RecruiterDashboardSummaryResponse,
    RecruiterJobReviewResponse,
)
from app.services.documents import DocumentValidationError, create_document_record, save_upload_file
from app.services.recruiter import (
    RecruiterCandidateNotFoundError,
    RecruiterJobNotFoundError,
    RecruiterManagementError,
    RecruiterProfileExistsError,
    RecruiterProfileNotFoundError,
    build_recruiter_candidate_comparison,
    build_recruiter_candidate_review,
    build_recruiter_candidate_response,
    build_recruiter_dashboard_summary,
    build_recruiter_job_list_item,
    build_recruiter_job_review,
    create_recruiter_candidate,
    create_recruiter_job,
    create_recruiter_profile,
    delete_recruiter_job,
    get_recruiter_candidate,
    get_recruiter_job,
    get_recruiter_profile,
    list_recruiter_jobs,
    update_recruiter_candidate_status,
    update_recruiter_profile,
    update_recruiter_job,
    validate_candidate_upload_type,
    validate_job_upload_type,
)

router = APIRouter(prefix="/recruiter")


@router.post(
    "/profile",
    response_model=RecruiterProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(
    payload: RecruiterProfileCreate,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterProfileResponse:
    try:
        profile = create_recruiter_profile(db, user=current_user, payload=payload)
    except RecruiterProfileExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return RecruiterProfileResponse.model_validate(profile)


@router.get("/profile", response_model=RecruiterProfileResponse)
def read_profile(
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterProfileResponse:
    profile = get_recruiter_profile(db, user_id=current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile was not found for this user.",
        )

    return RecruiterProfileResponse.model_validate(profile)


@router.put("/profile", response_model=RecruiterProfileResponse)
def update_profile(
    payload: RecruiterProfileUpdate,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterProfileResponse:
    try:
        profile = update_recruiter_profile(db, user=current_user, payload=payload)
    except RecruiterProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return RecruiterProfileResponse.model_validate(profile)


@router.get("/dashboard", response_model=RecruiterDashboardSummaryResponse)
def read_dashboard(
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterDashboardSummaryResponse:
    return build_recruiter_dashboard_summary(db, recruiter=current_user)


@router.post("/jobs", response_model=RecruiterJobDetailResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: RecruiterJobCreate,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterJobDetailResponse:
    job = create_recruiter_job(db, recruiter=current_user, payload=payload)
    hydrated_job = get_recruiter_job(db, recruiter=current_user, job_id=job.id)
    return RecruiterJobDetailResponse(
        **build_recruiter_job_list_item(hydrated_job).model_dump(),
        candidates=[],
    )


@router.get("/jobs", response_model=RecruiterJobListResponse)
def list_jobs(
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterJobListResponse:
    jobs = list_recruiter_jobs(db, recruiter=current_user)
    items = [build_recruiter_job_list_item(job) for job in jobs]
    return RecruiterJobListResponse(total=len(items), items=items)


@router.get("/jobs/{job_id}", response_model=RecruiterJobDetailResponse)
def get_job_detail(
    job_id: int,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterJobDetailResponse:
    try:
        job = get_recruiter_job(db, recruiter=current_user, job_id=job_id)
    except RecruiterJobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return RecruiterJobDetailResponse(
        **build_recruiter_job_list_item(job).model_dump(),
        candidates=[build_recruiter_candidate_response(candidate) for candidate in job.candidates],
    )


@router.put("/jobs/{job_id}", response_model=RecruiterJobDetailResponse)
def update_job(
    job_id: int,
    payload: RecruiterJobUpdate,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterJobDetailResponse:
    try:
        job = update_recruiter_job(
            db,
            recruiter=current_user,
            job_id=job_id,
            payload=payload,
        )
    except RecruiterJobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    hydrated_job = get_recruiter_job(db, recruiter=current_user, job_id=job.id)
    return RecruiterJobDetailResponse(
        **build_recruiter_job_list_item(hydrated_job).model_dump(),
        candidates=[build_recruiter_candidate_response(candidate) for candidate in hydrated_job.candidates],
    )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_200_OK)
def delete_job(
    job_id: int,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> dict[str, object]:
    try:
        delete_recruiter_job(
            db,
            recruiter=current_user,
            job_id=job_id,
        )
    except RecruiterJobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return {"job_id": job_id, "status": "deleted"}


@router.get("/jobs/{job_id}/review", response_model=RecruiterJobReviewResponse)
def get_job_review(
    job_id: int,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterJobReviewResponse:
    try:
        return build_recruiter_job_review(db, recruiter=current_user, job_id=job_id)
    except RecruiterJobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/jobs/{job_id}/comparison", response_model=RecruiterCandidateComparisonResponse)
def get_job_comparison(
    job_id: int,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterCandidateComparisonResponse:
    try:
        return build_recruiter_candidate_comparison(db, recruiter=current_user, job_id=job_id)
    except RecruiterJobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/jobs/{job_id}/candidates",
    response_model=RecruiterCandidateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_candidate_intake(
    job_id: int,
    payload: RecruiterCandidateIntakeCreate,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterCandidateResponse:
    try:
        candidate = create_recruiter_candidate(db, recruiter=current_user, job_id=job_id, payload=payload)
    except RecruiterJobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    hydrated_candidate = get_recruiter_candidate(
        db,
        recruiter=current_user,
        job_id=job_id,
        candidate_id=candidate.id,
    )
    return build_recruiter_candidate_response(hydrated_candidate)


@router.patch(
    "/jobs/{job_id}/candidates/{candidate_id}/status",
    response_model=RecruiterCandidateResponse,
)
def update_candidate_status(
    job_id: int,
    candidate_id: int,
    payload: RecruiterCandidateStatusUpdate,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterCandidateResponse:
    try:
        candidate = update_recruiter_candidate_status(
            db,
            recruiter=current_user,
            job_id=job_id,
            candidate_id=candidate_id,
            payload=payload,
        )
    except (RecruiterJobNotFoundError, RecruiterCandidateNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    hydrated_candidate = get_recruiter_candidate(
        db,
        recruiter=current_user,
        job_id=job_id,
        candidate_id=candidate.id,
    )
    return build_recruiter_candidate_response(hydrated_candidate)


@router.get(
    "/jobs/{job_id}/candidates/{candidate_id}/review",
    response_model=RecruiterCandidateReviewResponse,
)
def get_candidate_review(
    job_id: int,
    candidate_id: int,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> RecruiterCandidateReviewResponse:
    try:
        return build_recruiter_candidate_review(
            db,
            recruiter=current_user,
            job_id=job_id,
            candidate_id=candidate_id,
        )
    except (RecruiterJobNotFoundError, RecruiterCandidateNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/jobs/{job_id}/documents/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_job_document(
    job_id: int,
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> DocumentResponse:
    try:
        get_recruiter_job(db, recruiter=current_user, job_id=job_id)
        validate_job_upload_type(document_type)
        original_filename, storage_path, size_bytes = save_upload_file(
            file=file,
            user=current_user,
            document_type=document_type,
        )
    except RecruiterJobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except RecruiterManagementError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except DocumentValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    finally:
        file.file.close()

    document = create_document_record(
        db,
        user=current_user,
        document_type=document_type,
        original_filename=original_filename,
        storage_path=storage_path,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        recruiter_job_id=job_id,
    )
    return DocumentResponse.model_validate(document)


@router.post(
    "/jobs/{job_id}/candidates/{candidate_id}/documents/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_candidate_document(
    job_id: int,
    candidate_id: int,
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db_session),
) -> DocumentResponse:
    try:
        validate_candidate_upload_type(document_type)
        get_recruiter_candidate(
            db,
            recruiter=current_user,
            job_id=job_id,
            candidate_id=candidate_id,
        )
        original_filename, storage_path, size_bytes = save_upload_file(
            file=file,
            user=current_user,
            document_type=document_type,
        )
    except (RecruiterJobNotFoundError, RecruiterCandidateNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except RecruiterManagementError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except DocumentValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    finally:
        file.file.close()

    document = create_document_record(
        db,
        user=current_user,
        document_type=document_type,
        original_filename=original_filename,
        storage_path=storage_path,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        recruiter_job_id=job_id,
        recruiter_candidate_id=candidate_id,
    )
    return DocumentResponse.model_validate(document)
