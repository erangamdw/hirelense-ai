from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.report import ReportType, SavedReport
from app.models.user import User, UserRole
from app.schemas.report import SavedReportCreateRequest
from app.services.recruiter import (
    RecruiterCandidateNotFoundError,
    RecruiterJobNotFoundError,
    get_recruiter_candidate,
    get_recruiter_job,
)


ALLOWED_REPORT_TYPES_BY_ROLE: dict[UserRole, set[ReportType]] = {
    UserRole.CANDIDATE: {
        ReportType.CANDIDATE_INTERVIEW_QUESTIONS,
        ReportType.CANDIDATE_ANSWER_GUIDANCE,
        ReportType.CANDIDATE_STAR_ANSWER,
        ReportType.CANDIDATE_SKILL_GAP_ANALYSIS,
    },
    UserRole.RECRUITER: {
        ReportType.RECRUITER_FIT_SUMMARY,
        ReportType.RECRUITER_INTERVIEW_PACK,
    },
    UserRole.ADMIN: set(),
}


class ReportPersistenceError(Exception):
    """Raised when report persistence cannot be completed."""


class SavedReportNotFoundError(Exception):
    """Raised when a saved report is missing or not owned by the caller."""


def create_saved_report(
    db: Session,
    *,
    user: User,
    payload: SavedReportCreateRequest,
) -> SavedReport:
    validate_report_type_for_role(role=user.role, report_type=payload.report_type)
    recruiter_job_id, recruiter_candidate_id = resolve_report_scope(
        db,
        user=user,
        recruiter_job_id=payload.recruiter_job_id,
        recruiter_candidate_id=payload.recruiter_candidate_id,
    )
    saved_report = SavedReport(
        owner_user_id=user.id,
        recruiter_job_id=recruiter_job_id,
        recruiter_candidate_id=recruiter_candidate_id,
        owner_role=user.role,
        report_type=payload.report_type,
        title=payload.title or build_default_report_title(report_type=payload.report_type, query=payload.query),
        query=payload.query,
        payload_version=payload.payload_version,
        payload_json=payload.payload,
    )
    db.add(saved_report)
    db.commit()
    db.refresh(saved_report)
    return saved_report


def list_saved_reports(
    db: Session,
    *,
    user: User,
    report_type: ReportType | None = None,
    recruiter_job_id: int | None = None,
    recruiter_candidate_id: int | None = None,
    limit: int = 20,
) -> list[SavedReport]:
    if report_type is not None:
        validate_report_type_for_role(role=user.role, report_type=report_type)
    recruiter_job_id, recruiter_candidate_id = resolve_report_scope(
        db,
        user=user,
        recruiter_job_id=recruiter_job_id,
        recruiter_candidate_id=recruiter_candidate_id,
        require_any_scope=False,
    )

    statement: Select[tuple[SavedReport]] = (
        select(SavedReport)
        .where(SavedReport.owner_user_id == user.id)
        .order_by(SavedReport.created_at.desc(), SavedReport.id.desc())
        .limit(limit)
    )
    if report_type is not None:
        statement = statement.where(SavedReport.report_type == report_type)
    if recruiter_job_id is not None:
        statement = statement.where(SavedReport.recruiter_job_id == recruiter_job_id)
    if recruiter_candidate_id is not None:
        statement = statement.where(SavedReport.recruiter_candidate_id == recruiter_candidate_id)

    return list(db.execute(statement).scalars().all())


def get_owned_saved_report(
    db: Session,
    *,
    user: User,
    report_id: int,
) -> SavedReport:
    statement = select(SavedReport).where(
        SavedReport.id == report_id,
        SavedReport.owner_user_id == user.id,
    )
    report = db.execute(statement).scalar_one_or_none()
    if report is None:
        raise SavedReportNotFoundError("Saved report was not found.")
    return report


def validate_report_type_for_role(*, role: UserRole, report_type: ReportType) -> None:
    allowed = ALLOWED_REPORT_TYPES_BY_ROLE.get(role, set())
    if report_type not in allowed:
        raise ReportPersistenceError(
            f"Report type '{report_type.value}' is not available for role '{role.value}'."
        )


def build_default_report_title(*, report_type: ReportType, query: str) -> str:
    prefix_map: dict[ReportType, str] = {
        ReportType.CANDIDATE_INTERVIEW_QUESTIONS: "Candidate Interview Questions",
        ReportType.CANDIDATE_ANSWER_GUIDANCE: "Candidate Answer Guidance",
        ReportType.CANDIDATE_STAR_ANSWER: "Candidate STAR Answer",
        ReportType.CANDIDATE_SKILL_GAP_ANALYSIS: "Candidate Skill Gap Analysis",
        ReportType.RECRUITER_FIT_SUMMARY: "Recruiter Fit Summary",
        ReportType.RECRUITER_INTERVIEW_PACK: "Recruiter Interview Pack",
    }
    prefix = prefix_map[report_type]
    return f"{prefix}: {truncate_query(query, limit=80)}"


def truncate_query(query: str, *, limit: int) -> str:
    normalized = " ".join(query.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def resolve_report_scope(
    db: Session,
    *,
    user: User,
    recruiter_job_id: int | None,
    recruiter_candidate_id: int | None,
    require_any_scope: bool = False,
) -> tuple[int | None, int | None]:
    if user.role != UserRole.RECRUITER:
        if recruiter_job_id is not None or recruiter_candidate_id is not None:
            raise ReportPersistenceError("Recruiter job and candidate report scoping is only available to recruiters.")
        return None, None

    if recruiter_job_id is None and recruiter_candidate_id is None:
        if require_any_scope:
            raise ReportPersistenceError("A recruiter report scope is required.")
        return None, None

    resolved_job_id = recruiter_job_id
    resolved_candidate_id = recruiter_candidate_id

    try:
        if recruiter_job_id is not None:
            get_recruiter_job(db, recruiter=user, job_id=recruiter_job_id)
        if recruiter_candidate_id is not None:
            candidate = get_recruiter_candidate(
                db,
                recruiter=user,
                job_id=recruiter_job_id,
                candidate_id=recruiter_candidate_id,
            )
            resolved_job_id = candidate.job_id
            resolved_candidate_id = candidate.id
    except (RecruiterJobNotFoundError, RecruiterCandidateNotFoundError) as exc:
        raise ReportPersistenceError(str(exc)) from exc

    return resolved_job_id, resolved_candidate_id
