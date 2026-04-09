from __future__ import annotations

from pathlib import Path

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.document import DocumentType
from app.models.report import SavedReport
from app.models.recruiter import RecruiterCandidate, RecruiterCandidateStatus, RecruiterJob
from app.models.user import User
from app.schemas.recruiter import (
    RecruiterCandidateIntakeCreate,
    RecruiterCandidateStatusUpdate,
    RecruiterJobCreate,
    RecruiterJobUpdate,
)
from app.services.rag import ChromaVectorStoreError, delete_document_vectors

JOB_UPLOAD_DOCUMENT_TYPES = {
    DocumentType.JOB_DESCRIPTION,
}

CANDIDATE_UPLOAD_DOCUMENT_TYPES = {
    DocumentType.RECRUITER_CANDIDATE_CV,
    DocumentType.INTERVIEW_FEEDBACK,
}


class RecruiterManagementError(Exception):
    """Raised when recruiter entity operations fail validation."""


class RecruiterJobNotFoundError(Exception):
    """Raised when a recruiter job does not exist for the caller."""


class RecruiterCandidateNotFoundError(Exception):
    """Raised when a recruiter candidate does not exist for the caller."""


def create_recruiter_job(
    db: Session,
    *,
    recruiter: User,
    payload: RecruiterJobCreate,
) -> RecruiterJob:
    job = RecruiterJob(
        recruiter_user_id=recruiter.id,
        title=payload.title,
        description=payload.description,
        seniority=payload.seniority,
        location=payload.location,
        skills_required=payload.skills_required,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def list_recruiter_jobs(db: Session, *, recruiter: User) -> list[RecruiterJob]:
    statement: Select[tuple[RecruiterJob]] = (
        select(RecruiterJob)
        .where(RecruiterJob.recruiter_user_id == recruiter.id)
        .options(
            selectinload(RecruiterJob.candidates).selectinload(RecruiterCandidate.documents),
            selectinload(RecruiterJob.documents),
        )
        .order_by(RecruiterJob.created_at.desc(), RecruiterJob.id.desc())
    )
    return list(db.execute(statement).scalars().all())


def update_recruiter_job(
    db: Session,
    *,
    recruiter: User,
    job_id: int,
    payload: RecruiterJobUpdate,
) -> RecruiterJob:
    job = get_recruiter_job(db, recruiter=recruiter, job_id=job_id)
    job.title = payload.title
    job.description = payload.description
    job.seniority = payload.seniority
    job.location = payload.location
    job.skills_required = payload.skills_required
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def delete_recruiter_job(
    db: Session,
    *,
    recruiter: User,
    job_id: int,
) -> None:
    job = get_recruiter_job(
        db,
        recruiter=recruiter,
        job_id=job_id,
    )

    candidate_ids = [candidate.id for candidate in job.candidates]
    scoped_documents = list(job.documents)
    report_scope_filters = [SavedReport.recruiter_job_id == job.id]
    if candidate_ids:
        report_scope_filters.append(SavedReport.recruiter_candidate_id.in_(candidate_ids))

    scoped_reports = list(
        db.execute(
            select(SavedReport).where(
                SavedReport.owner_user_id == recruiter.id,
                or_(*report_scope_filters),
            )
        ).scalars()
    )

    storage_paths = [Path(document.storage_path) for document in scoped_documents]

    for document in scoped_documents:
        try:
            delete_document_vectors(document_id=document.id, owner_user_id=document.owner_user_id)
        except ChromaVectorStoreError:
            pass
        db.delete(document)

    for report in scoped_reports:
        db.delete(report)

    for candidate in job.candidates:
        db.delete(candidate)

    db.delete(job)
    db.commit()

    for storage_path in storage_paths:
        try:
            if storage_path.exists():
                storage_path.unlink()
        except OSError:
            pass


def get_recruiter_job(db: Session, *, recruiter: User, job_id: int) -> RecruiterJob:
    statement = (
        select(RecruiterJob)
        .where(
            RecruiterJob.id == job_id,
            RecruiterJob.recruiter_user_id == recruiter.id,
        )
        .options(
            selectinload(RecruiterJob.candidates).selectinload(RecruiterCandidate.documents),
            selectinload(RecruiterJob.documents),
        )
    )
    job = db.execute(statement).scalar_one_or_none()
    if job is None:
        raise RecruiterJobNotFoundError("Recruiter job was not found.")
    return job


def create_recruiter_candidate(
    db: Session,
    *,
    recruiter: User,
    job_id: int,
    payload: RecruiterCandidateIntakeCreate,
) -> RecruiterCandidate:
    job = get_recruiter_job(db, recruiter=recruiter, job_id=job_id)
    candidate = RecruiterCandidate(
        recruiter_user_id=recruiter.id,
        job_id=job.id,
        full_name=payload.full_name,
        email=str(payload.email) if payload.email else None,
        current_title=payload.current_title,
        notes=payload.notes,
        shortlist_status=RecruiterCandidateStatus.UNDER_REVIEW,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def get_recruiter_candidate(
    db: Session,
    *,
    recruiter: User,
    job_id: int | None,
    candidate_id: int,
) -> RecruiterCandidate:
    statement = select(RecruiterCandidate).where(
        RecruiterCandidate.id == candidate_id,
        RecruiterCandidate.recruiter_user_id == recruiter.id,
    )
    if job_id is not None:
        statement = statement.where(RecruiterCandidate.job_id == job_id)
    statement = statement.options(selectinload(RecruiterCandidate.documents))
    candidate = db.execute(statement).scalar_one_or_none()
    if candidate is None:
        raise RecruiterCandidateNotFoundError("Recruiter candidate was not found for this job.")
    return candidate


def validate_job_upload_type(document_type: DocumentType) -> None:
    if document_type not in JOB_UPLOAD_DOCUMENT_TYPES:
        allowed = ", ".join(sorted(item.value for item in JOB_UPLOAD_DOCUMENT_TYPES))
        raise RecruiterManagementError(
            f"Document type '{document_type.value}' is not supported for recruiter job uploads. "
            f"Allowed: {allowed}."
        )


def validate_candidate_upload_type(document_type: DocumentType) -> None:
    if document_type not in CANDIDATE_UPLOAD_DOCUMENT_TYPES:
        allowed = ", ".join(sorted(item.value for item in CANDIDATE_UPLOAD_DOCUMENT_TYPES))
        raise RecruiterManagementError(
            f"Document type '{document_type.value}' is not supported for recruiter candidate uploads. "
            f"Allowed: {allowed}."
        )


def update_recruiter_candidate_status(
    db: Session,
    *,
    recruiter: User,
    job_id: int,
    candidate_id: int,
    payload: RecruiterCandidateStatusUpdate,
) -> RecruiterCandidate:
    candidate = get_recruiter_candidate(
        db,
        recruiter=recruiter,
        job_id=job_id,
        candidate_id=candidate_id,
    )
    candidate.shortlist_status = payload.shortlist_status
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def build_recruiter_candidate_response(candidate: RecruiterCandidate):
    from app.schemas.recruiter import RecruiterCandidateResponse

    return RecruiterCandidateResponse.model_validate(
        {
            "id": candidate.id,
            "recruiter_user_id": candidate.recruiter_user_id,
            "job_id": candidate.job_id,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "current_title": candidate.current_title,
            "notes": candidate.notes,
            "shortlist_status": candidate.shortlist_status,
            "document_count": len(candidate.documents),
            "created_at": candidate.created_at,
            "updated_at": candidate.updated_at,
        }
    )


def build_recruiter_job_list_item(job: RecruiterJob):
    from app.schemas.recruiter import RecruiterJobListItemResponse

    return RecruiterJobListItemResponse.model_validate(
        {
            "id": job.id,
            "recruiter_user_id": job.recruiter_user_id,
            "title": job.title,
            "description": job.description,
            "seniority": job.seniority,
            "location": job.location,
            "skills_required": job.skills_required,
            "candidate_count": len(job.candidates),
            "linked_document_count": len(job.documents),
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }
    )
