from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.recruiter import RecruiterCandidateStatus


class RecruiterJobBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    seniority: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=255)
    skills_required: list[str] = Field(default_factory=list)


class RecruiterJobCreate(RecruiterJobBase):
    pass


class RecruiterJobUpdate(RecruiterJobBase):
    pass


class RecruiterCandidateIntakeCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    current_title: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class RecruiterCandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    recruiter_user_id: int
    job_id: int
    full_name: str
    email: str | None
    current_title: str | None
    notes: str | None
    shortlist_status: RecruiterCandidateStatus
    document_count: int = 0
    created_at: datetime
    updated_at: datetime


class RecruiterCandidateStatusUpdate(BaseModel):
    shortlist_status: RecruiterCandidateStatus


class RecruiterJobListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    recruiter_user_id: int
    title: str
    description: str
    seniority: str | None
    location: str | None
    skills_required: list[str]
    candidate_count: int = 0
    linked_document_count: int = 0
    created_at: datetime
    updated_at: datetime


class RecruiterJobDetailResponse(RecruiterJobListItemResponse):
    candidates: list[RecruiterCandidateResponse] = Field(default_factory=list)


class RecruiterJobListResponse(BaseModel):
    total: int
    items: list[RecruiterJobListItemResponse]
