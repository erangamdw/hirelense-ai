from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

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
    document_count: int
    document_types: list[str] = Field(default_factory=list)
    report_count: int
    latest_report_title: str | None
    latest_report_type: ReportType | None
    latest_report_created_at: datetime | None
    report_history: list[RecruiterDashboardRecentReportResponse] = Field(default_factory=list)
