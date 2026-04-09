from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.recruiter import RecruiterCandidateStatus
from app.models.report import ReportType


class RecruiterDashboardRecentReportResponse(BaseModel):
    id: int
    title: str
    report_type: ReportType
    recruiter_job_id: int | None
    recruiter_candidate_id: int | None
    created_at: datetime


class RecruiterDashboardSummaryResponse(BaseModel):
    user_id: int
    email: str
    full_name: str | None
    jobs_count: int
    candidate_count: int
    candidate_document_count: int
    report_count: int
    recent_reports: list[RecruiterDashboardRecentReportResponse] = Field(default_factory=list)
    recent_candidate_names: list[str] = Field(default_factory=list)


class RecruiterJobReviewCandidateResponse(BaseModel):
    id: int
    full_name: str
    current_title: str | None
    notes: str | None
    shortlist_status: RecruiterCandidateStatus
    document_count: int
    report_count: int
    latest_report_title: str | None
    latest_report_type: ReportType | None
    latest_report_created_at: datetime | None


class RecruiterJobReviewResponse(BaseModel):
    job_id: int
    title: str
    description: str
    seniority: str | None
    location: str | None
    skills_required: list[str]
    job_document_count: int
    candidate_count: int
    report_count: int
    latest_report_title: str | None
    latest_report_type: ReportType | None
    latest_report_created_at: datetime | None
    candidates: list[RecruiterJobReviewCandidateResponse] = Field(default_factory=list)


class RecruiterCandidateReviewResponse(BaseModel):
    candidate_id: int
    job_id: int
    full_name: str
    email: str | None
    current_title: str | None
    notes: str | None
    shortlist_status: RecruiterCandidateStatus
    document_count: int
    document_types: list[str] = Field(default_factory=list)
    report_count: int
    latest_report_title: str | None
    latest_report_type: ReportType | None
    latest_report_created_at: datetime | None
    report_history: list[RecruiterDashboardRecentReportResponse] = Field(default_factory=list)


class RecruiterComparisonStrengthResponse(BaseModel):
    title: str
    summary: str
    evidence_chunk_ids: list[int] = Field(default_factory=list)


class RecruiterComparisonConcernResponse(BaseModel):
    title: str
    summary: str
    evidence_chunk_ids: list[int] = Field(default_factory=list)


class RecruiterComparisonDimensionResponse(BaseModel):
    title: str
    score: int
    summary: str


class RecruiterCandidateComparisonItemResponse(BaseModel):
    candidate_id: int
    full_name: str
    current_title: str | None
    notes: str | None
    rank_position: int
    overall_match_score: int
    shortlist_status: RecruiterCandidateStatus
    document_count: int
    report_count: int
    latest_fit_summary_report_id: int | None
    latest_fit_summary_title: str | None
    latest_fit_summary_created_at: datetime | None
    fit_summary_summary: str | None
    fit_summary_recommendation: str | None
    skill_match: RecruiterComparisonDimensionResponse
    tech_stack_match: RecruiterComparisonDimensionResponse
    qualification_match: RecruiterComparisonDimensionResponse
    experience_match: RecruiterComparisonDimensionResponse
    strengths: list[RecruiterComparisonStrengthResponse] = Field(default_factory=list)
    concerns: list[RecruiterComparisonConcernResponse] = Field(default_factory=list)
    missing_evidence_areas: list[str] = Field(default_factory=list)
    needs_fit_summary: bool = False


class RecruiterCandidateComparisonResponse(BaseModel):
    job_id: int
    title: str
    description: str
    candidate_count: int
    ranking_basis: str
    candidates: list[RecruiterCandidateComparisonItemResponse] = Field(default_factory=list)
