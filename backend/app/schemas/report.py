from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.report import ReportType
from app.models.user import UserRole


class SavedReportCreateRequest(BaseModel):
    report_type: ReportType
    query: str = Field(min_length=3, max_length=2000)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    recruiter_job_id: int | None = Field(default=None, ge=1)
    recruiter_candidate_id: int | None = Field(default=None, ge=1)
    payload: dict[str, Any]
    payload_version: int = Field(default=1, ge=1, le=20)


class SavedReportListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int
    recruiter_job_id: int | None
    recruiter_candidate_id: int | None
    owner_role: UserRole
    report_type: ReportType
    title: str
    query: str
    payload_version: int
    created_at: datetime


class SavedReportResponse(SavedReportListItemResponse):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    payload: dict[str, Any] = Field(validation_alias="payload_json")


class SavedReportHistoryResponse(BaseModel):
    total: int
    items: list[SavedReportListItemResponse]
