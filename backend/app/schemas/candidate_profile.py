from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class CandidateProfileBase(BaseModel):
    headline: str | None = Field(default=None, max_length=255)
    bio: str | None = None
    location: str | None = Field(default=None, max_length=255)
    years_experience: int | None = Field(default=None, ge=0, le=80)
    linkedin_url: HttpUrl | None = None
    github_url: HttpUrl | None = None
    portfolio_url: HttpUrl | None = None
    target_roles: list[str] = Field(default_factory=list)


class CandidateProfileCreate(CandidateProfileBase):
    pass


class CandidateProfileUpdate(CandidateProfileBase):
    pass


class CandidateProfileResponse(CandidateProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


class CandidateDashboardSummary(BaseModel):
    user_id: int
    email: str
    full_name: str | None
    has_profile: bool
    target_roles: list[str] = Field(default_factory=list)
    uploaded_document_count: int
    saved_report_count: int
    latest_interview_sessions: list[str] = Field(default_factory=list)
