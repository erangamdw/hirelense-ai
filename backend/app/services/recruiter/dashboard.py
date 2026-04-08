from __future__ import annotations

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.report import SavedReport
from app.models.recruiter import RecruiterCandidate, RecruiterJob
from app.models.user import User
from app.schemas.recruiter_dashboard import (
    RecruiterCandidateReviewResponse,
    RecruiterDashboardRecentReportResponse,
    RecruiterDashboardSummaryResponse,
    RecruiterJobReviewCandidateResponse,
    RecruiterJobReviewResponse,
)
from app.services.recruiter.management import (
    RecruiterCandidateNotFoundError,
    RecruiterJobNotFoundError,
    get_recruiter_candidate,
    get_recruiter_job,
    list_recruiter_jobs,
)


def build_recruiter_dashboard_summary(db: Session, *, recruiter: User) -> RecruiterDashboardSummaryResponse:
    jobs = list_recruiter_jobs(db, recruiter=recruiter)
    report_count = int(
        db.execute(
            select(func.count(SavedReport.id)).where(SavedReport.owner_user_id == recruiter.id)
        ).scalar_one()
    )
    recent_reports = list(
        db.execute(
            select(SavedReport)
            .where(SavedReport.owner_user_id == recruiter.id)
            .order_by(SavedReport.created_at.desc(), SavedReport.id.desc())
            .limit(5)
        ).scalars()
    )

    candidate_count = sum(len(job.candidates) for job in jobs)
    candidate_document_count = sum(len(candidate.documents) for job in jobs for candidate in job.candidates)
    recent_candidates = [
        candidate.full_name
        for job in jobs
        for candidate in sorted(job.candidates, key=lambda item: (item.created_at, item.id), reverse=True)[:3]
    ][:5]

    return RecruiterDashboardSummaryResponse(
        user_id=recruiter.id,
        email=recruiter.email,
        full_name=recruiter.full_name,
        jobs_count=len(jobs),
        candidate_count=candidate_count,
        candidate_document_count=candidate_document_count,
        report_count=report_count,
        recent_reports=[build_recent_report_item(report) for report in recent_reports],
        recent_candidate_names=recent_candidates,
    )


def build_recruiter_job_review(db: Session, *, recruiter: User, job_id: int) -> RecruiterJobReviewResponse:
    job = get_recruiter_job_with_reports(db, recruiter=recruiter, job_id=job_id)
    job_reports = sorted(job.saved_reports, key=lambda item: (item.created_at, item.id), reverse=True)
    direct_job_documents = [document for document in job.documents if document.recruiter_candidate_id is None]

    candidates = [
        RecruiterJobReviewCandidateResponse(
            id=candidate.id,
            full_name=candidate.full_name,
            current_title=candidate.current_title,
            notes=candidate.notes,
            document_count=len(candidate.documents),
            report_count=len(candidate.saved_reports),
            latest_report_title=candidate.saved_reports[0].title if candidate.saved_reports else None,
            latest_report_type=candidate.saved_reports[0].report_type if candidate.saved_reports else None,
            latest_report_created_at=candidate.saved_reports[0].created_at if candidate.saved_reports else None,
        )
        for candidate in job.candidates
    ]

    return RecruiterJobReviewResponse(
        job_id=job.id,
        title=job.title,
        description=job.description,
        seniority=job.seniority,
        location=job.location,
        skills_required=job.skills_required,
        job_document_count=len(direct_job_documents),
        candidate_count=len(job.candidates),
        report_count=len(job_reports),
        latest_report_title=job_reports[0].title if job_reports else None,
        latest_report_type=job_reports[0].report_type if job_reports else None,
        latest_report_created_at=job_reports[0].created_at if job_reports else None,
        candidates=candidates,
    )


def build_recruiter_candidate_review(
    db: Session,
    *,
    recruiter: User,
    job_id: int,
    candidate_id: int,
) -> RecruiterCandidateReviewResponse:
    get_recruiter_job_with_reports(db, recruiter=recruiter, job_id=job_id)
    candidate = get_recruiter_candidate_with_reports(
        db,
        recruiter=recruiter,
        job_id=job_id,
        candidate_id=candidate_id,
    )
    candidate_reports = sorted(candidate.saved_reports, key=lambda item: (item.created_at, item.id), reverse=True)
    document_types = sorted({document.document_type.value for document in candidate.documents})

    return RecruiterCandidateReviewResponse(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        full_name=candidate.full_name,
        email=candidate.email,
        current_title=candidate.current_title,
        notes=candidate.notes,
        document_count=len(candidate.documents),
        document_types=document_types,
        report_count=len(candidate_reports),
        latest_report_title=candidate_reports[0].title if candidate_reports else None,
        latest_report_type=candidate_reports[0].report_type if candidate_reports else None,
        latest_report_created_at=candidate_reports[0].created_at if candidate_reports else None,
        report_history=[build_recent_report_item(report) for report in candidate_reports[:5]],
    )


def get_recruiter_job_with_reports(db: Session, *, recruiter: User, job_id: int) -> RecruiterJob:
    statement: Select[tuple[RecruiterJob]] = (
        select(RecruiterJob)
        .where(
            RecruiterJob.id == job_id,
            RecruiterJob.recruiter_user_id == recruiter.id,
        )
        .options(
            selectinload(RecruiterJob.documents),
            selectinload(RecruiterJob.saved_reports),
            selectinload(RecruiterJob.candidates).selectinload(RecruiterCandidate.documents),
            selectinload(RecruiterJob.candidates).selectinload(RecruiterCandidate.saved_reports),
        )
    )
    job = db.execute(statement).scalar_one_or_none()
    if job is None:
        raise RecruiterJobNotFoundError("Recruiter job was not found.")
    return job


def get_recruiter_candidate_with_reports(
    db: Session,
    *,
    recruiter: User,
    job_id: int,
    candidate_id: int,
) -> RecruiterCandidate:
    statement: Select[tuple[RecruiterCandidate]] = (
        select(RecruiterCandidate)
        .where(
            RecruiterCandidate.id == candidate_id,
            RecruiterCandidate.job_id == job_id,
            RecruiterCandidate.recruiter_user_id == recruiter.id,
        )
        .options(
            selectinload(RecruiterCandidate.documents),
            selectinload(RecruiterCandidate.saved_reports),
        )
    )
    candidate = db.execute(statement).scalar_one_or_none()
    if candidate is None:
        raise RecruiterCandidateNotFoundError("Recruiter candidate was not found for this job.")
    return candidate


def build_recent_report_item(report: SavedReport) -> RecruiterDashboardRecentReportResponse:
    return RecruiterDashboardRecentReportResponse(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        recruiter_job_id=report.recruiter_job_id,
        recruiter_candidate_id=report.recruiter_candidate_id,
        created_at=report.created_at,
    )
