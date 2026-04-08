from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RecruiterType(str, Enum):
    IN_HOUSE = "in_house"
    AGENCY = "agency"
    HIRING_MANAGER = "hiring_manager"


class RecruiterProfileBase(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    recruiter_type: RecruiterType
    organisation_size: str | None = Field(default=None, max_length=100)

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, value: str) -> str:
        normalized = " ".join(value.split()).strip()
        if len(normalized) < 2:
            raise ValueError("Company name must contain at least 2 non-space characters.")
        return normalized

    @field_validator("organisation_size")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.split()).strip()
        return normalized or None


class RecruiterProfileCreate(RecruiterProfileBase):
    pass


class RecruiterProfileUpdate(RecruiterProfileBase):
    pass


class RecruiterProfileResponse(RecruiterProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
