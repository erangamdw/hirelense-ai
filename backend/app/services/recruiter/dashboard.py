from __future__ import annotations

import re
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.report import SavedReport
from app.models.recruiter import RecruiterCandidate, RecruiterJob
from app.models.user import User
from app.schemas.recruiter_dashboard import (
    RecruiterCandidateComparisonItemResponse,
    RecruiterCandidateComparisonResponse,
    RecruiterCandidateReviewResponse,
    RecruiterComparisonConcernResponse,
    RecruiterComparisonDimensionResponse,
    RecruiterComparisonStrengthResponse,
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
            shortlist_status=candidate.shortlist_status,
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
        shortlist_status=candidate.shortlist_status,
        document_count=len(candidate.documents),
        document_types=document_types,
        report_count=len(candidate_reports),
        latest_report_title=candidate_reports[0].title if candidate_reports else None,
        latest_report_type=candidate_reports[0].report_type if candidate_reports else None,
        latest_report_created_at=candidate_reports[0].created_at if candidate_reports else None,
        report_history=[build_recent_report_item(report) for report in candidate_reports[:5]],
    )


def build_recruiter_candidate_comparison(
    db: Session,
    *,
    recruiter: User,
    job_id: int,
) -> RecruiterCandidateComparisonResponse:
    job = get_recruiter_job_with_reports(db, recruiter=recruiter, job_id=job_id)

    candidates = [build_candidate_comparison_item(job, candidate) for candidate in job.candidates]
    candidates.sort(
        key=lambda item: (
            item.overall_match_score,
            shortlist_rank(item.shortlist_status),
            0 if item.needs_fit_summary else 1,
            item.report_count,
            item.document_count,
            item.full_name.lower(),
        ),
        reverse=True,
    )
    ranked_candidates = [
        item.model_copy(update={"rank_position": index})
        for index, item in enumerate(candidates, start=1)
    ]

    return RecruiterCandidateComparisonResponse(
        job_id=job.id,
        title=job.title,
        description=job.description,
        candidate_count=len(job.candidates),
        ranking_basis="Ranked by overall role match across skills, tech stack, qualifications, and experience, then adjusted by shortlist status and saved analysis.",
        candidates=ranked_candidates,
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


def build_candidate_comparison_item(job: RecruiterJob, candidate: RecruiterCandidate) -> RecruiterCandidateComparisonItemResponse:
    candidate_reports = sorted(candidate.saved_reports, key=lambda item: (item.created_at, item.id), reverse=True)
    latest_fit_summary = next(
        (report for report in candidate_reports if report.report_type.value == "recruiter_fit_summary"),
        None,
    )

    strengths: list[RecruiterComparisonStrengthResponse] = []
    concerns: list[RecruiterComparisonConcernResponse] = []
    missing_evidence_areas: list[str] = []
    summary: str | None = None
    recommendation: str | None = None

    if latest_fit_summary is not None:
        payload = latest_fit_summary.payload_json if isinstance(latest_fit_summary.payload_json, dict) else {}
        summary = get_text_value(payload.get("summary"))
        recommendation = get_text_value(payload.get("recommendation"))
        missing_evidence_areas = get_string_list(payload.get("missing_evidence_areas"))
        strengths = [
            RecruiterComparisonStrengthResponse(
                title=get_text_value(item.get("title")) or "Strength",
                summary=get_text_value(item.get("summary")) or "",
                evidence_chunk_ids=get_int_list(item.get("evidence_chunk_ids")),
            )
            for item in get_dict_list(payload.get("strengths"))
        ]
        concerns = [
            RecruiterComparisonConcernResponse(
                title=get_text_value(item.get("title")) or "Concern",
                summary=get_text_value(item.get("summary")) or "",
                evidence_chunk_ids=get_int_list(item.get("evidence_chunk_ids")),
            )
            for item in get_dict_list(payload.get("concerns"))
        ]

    candidate_text = build_candidate_comparison_text(candidate, latest_fit_summary)
    job_text = build_job_requirement_text(job)
    skill_match = build_skill_match_dimension(job=job, candidate_text=candidate_text)
    tech_stack_match = build_tech_stack_match_dimension(job_text=job_text, candidate_text=candidate_text)
    qualification_match = build_qualification_match_dimension(job_text=job_text, candidate_text=candidate_text)
    experience_match = build_experience_match_dimension(job=job, candidate=candidate, candidate_text=candidate_text)
    overall_match_score = round(
        skill_match.score * 0.35
        + tech_stack_match.score * 0.25
        + qualification_match.score * 0.15
        + experience_match.score * 0.25
    )

    return RecruiterCandidateComparisonItemResponse(
        candidate_id=candidate.id,
        full_name=candidate.full_name,
        current_title=candidate.current_title,
        notes=candidate.notes,
        rank_position=0,
        overall_match_score=overall_match_score,
        shortlist_status=candidate.shortlist_status,
        document_count=len(candidate.documents),
        report_count=len(candidate_reports),
        latest_fit_summary_report_id=latest_fit_summary.id if latest_fit_summary else None,
        latest_fit_summary_title=latest_fit_summary.title if latest_fit_summary else None,
        latest_fit_summary_created_at=latest_fit_summary.created_at if latest_fit_summary else None,
        fit_summary_summary=summary,
        fit_summary_recommendation=recommendation,
        skill_match=skill_match,
        tech_stack_match=tech_stack_match,
        qualification_match=qualification_match,
        experience_match=experience_match,
        strengths=strengths[:3],
        concerns=concerns[:3],
        missing_evidence_areas=missing_evidence_areas[:3],
        needs_fit_summary=latest_fit_summary is None,
    )


def shortlist_rank(value: Any) -> int:
    status = getattr(value, "value", value)
    if status == "shortlisted":
        return 3
    if status == "under_review":
        return 2
    if status == "declined":
        return 1
    return 0


KNOWN_TECH_TERMS = {
    "python",
    "django",
    "fastapi",
    "flask",
    "sql",
    "postgresql",
    "postgres",
    "mysql",
    "mongodb",
    "typescript",
    "javascript",
    "react",
    "nextjs",
    "next",
    "node",
    "docker",
    "kubernetes",
    "aws",
    "gcp",
    "azure",
    "openai",
    "langchain",
    "chroma",
    "redis",
    "pytorch",
    "torch",
}

QUALIFICATION_TERMS = {
    "degree": "Degree or formal qualification",
    "bachelor": "Bachelor's level background",
    "master": "Master's level background",
    "phd": "Advanced academic background",
    "certification": "Relevant certification",
    "certified": "Relevant certification",
}

SENIORITY_TARGETS = {
    "junior": 35,
    "mid": 55,
    "senior": 75,
    "lead": 85,
    "staff": 90,
    "principal": 95,
}


def build_candidate_comparison_text(candidate: RecruiterCandidate, latest_fit_summary: SavedReport | None) -> str:
    parts: list[str] = [
        candidate.full_name,
        candidate.current_title or "",
        candidate.notes or "",
    ]
    for document in candidate.documents:
        if isinstance(document.parsed_text, str):
            parts.append(document.parsed_text)
    if latest_fit_summary is not None and isinstance(latest_fit_summary.payload_json, dict):
        payload = latest_fit_summary.payload_json
        parts.append(get_text_value(payload.get("summary")) or "")
        parts.append(get_text_value(payload.get("recommendation")) or "")
        for item in get_dict_list(payload.get("strengths")):
            parts.append(get_text_value(item.get("title")) or "")
            parts.append(get_text_value(item.get("summary")) or "")
        for item in get_dict_list(payload.get("concerns")):
            parts.append(get_text_value(item.get("title")) or "")
            parts.append(get_text_value(item.get("summary")) or "")
    return " ".join(part for part in parts if part).lower()


def build_job_requirement_text(job: RecruiterJob) -> str:
    parts: list[str] = [
        job.title,
        job.description,
        job.seniority or "",
        job.location or "",
        " ".join(job.skills_required),
    ]
    for document in job.documents:
        if isinstance(document.parsed_text, str):
            parts.append(document.parsed_text)
    return " ".join(part for part in parts if part).lower()


def build_skill_match_dimension(*, job: RecruiterJob, candidate_text: str) -> RecruiterComparisonDimensionResponse:
    required_skills = [normalize_phrase(skill) for skill in job.skills_required if normalize_phrase(skill)]
    if not required_skills:
        return RecruiterComparisonDimensionResponse(
            title="Skill match",
            score=70,
            summary="No explicit required-skill list was saved for this role, so the score falls back to neutral.",
        )

    matched_skills = [skill for skill in required_skills if phrase_in_text(skill, candidate_text)]
    score = round((len(matched_skills) / len(required_skills)) * 100)
    summary = (
        f"Matched {len(matched_skills)} of {len(required_skills)} required skills"
        + (f": {', '.join(matched_skills[:4])}." if matched_skills else ".")
    )
    return RecruiterComparisonDimensionResponse(title="Skill match", score=score, summary=summary)


def build_tech_stack_match_dimension(*, job_text: str, candidate_text: str) -> RecruiterComparisonDimensionResponse:
    relevant_terms = [term for term in KNOWN_TECH_TERMS if term in job_text]
    if not relevant_terms:
        return RecruiterComparisonDimensionResponse(
            title="Tech stack match",
            score=68,
            summary="The role brief does not name a strong technical stack, so this score stays neutral.",
        )
    matched_terms = [term for term in relevant_terms if term in candidate_text]
    score = round((len(matched_terms) / len(relevant_terms)) * 100)
    summary = (
        f"Matched {len(matched_terms)} of {len(relevant_terms)} role technologies"
        + (f": {', '.join(matched_terms[:5])}." if matched_terms else ".")
    )
    return RecruiterComparisonDimensionResponse(title="Tech stack match", score=score, summary=summary)


def build_qualification_match_dimension(*, job_text: str, candidate_text: str) -> RecruiterComparisonDimensionResponse:
    required_labels = [label for term, label in QUALIFICATION_TERMS.items() if term in job_text]
    if not required_labels:
        return RecruiterComparisonDimensionResponse(
            title="Qualifications",
            score=72,
            summary="The role brief does not call out a strict qualification requirement.",
        )
    matched_labels = [label for term, label in QUALIFICATION_TERMS.items() if term in job_text and term in candidate_text]
    score = round((len(matched_labels) / len(required_labels)) * 100)
    summary = (
        f"Matched {len(matched_labels)} of {len(required_labels)} qualification signals"
        + (f": {', '.join(matched_labels[:3])}." if matched_labels else ".")
    )
    return RecruiterComparisonDimensionResponse(title="Qualifications", score=score, summary=summary)


def build_experience_match_dimension(
    *,
    job: RecruiterJob,
    candidate: RecruiterCandidate,
    candidate_text: str,
) -> RecruiterComparisonDimensionResponse:
    seniority_target = max(
        (target for label, target in SENIORITY_TARGETS.items() if label in (job.seniority or "").lower()),
        default=60,
    )
    candidate_years = extract_years(candidate_text)
    candidate_title = (candidate.current_title or "").lower()
    title_boost = max((target for label, target in SENIORITY_TARGETS.items() if label in candidate_title), default=45)
    years_boost = min(candidate_years * 10, 95) if candidate_years is not None else 55
    score = min(100, round((seniority_target * 0.4) + (title_boost * 0.35) + (years_boost * 0.25)))
    summary_parts: list[str] = []
    if candidate.current_title:
        summary_parts.append(f"Current title: {candidate.current_title}.")
    if candidate_years is not None:
        summary_parts.append(f"Detected approximately {candidate_years} years of experience in the candidate evidence.")
    else:
        summary_parts.append("Experience score is based on title, recruiter notes, and available candidate evidence.")
    return RecruiterComparisonDimensionResponse(title="Experience", score=score, summary=" ".join(summary_parts))


def normalize_phrase(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+.#/\- ]+", " ", value.lower())).strip()


def phrase_in_text(phrase: str, text: str) -> bool:
    return phrase in normalize_phrase(text)


def extract_years(text: str) -> int | None:
    matches = [int(match) for match in re.findall(r"(\d+)\+?\s+years?", text)]
    if not matches:
        return None
    return max(matches)


def get_text_value(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = " ".join(value.split()).strip()
        return normalized or None
    return None


def get_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def get_int_list(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, int)]


def get_dict_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]
