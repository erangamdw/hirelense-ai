from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import JSON, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.user import UserRole


class ReportType(str, Enum):
    CANDIDATE_INTERVIEW_QUESTIONS = "candidate_interview_questions"
    CANDIDATE_ANSWER_GUIDANCE = "candidate_answer_guidance"
    CANDIDATE_STAR_ANSWER = "candidate_star_answer"
    CANDIDATE_SKILL_GAP_ANALYSIS = "candidate_skill_gap_analysis"
    RECRUITER_FIT_SUMMARY = "recruiter_fit_summary"
    RECRUITER_INTERVIEW_PACK = "recruiter_interview_pack"


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recruiter_job_id: Mapped[int | None] = mapped_column(
        ForeignKey("recruiter_jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recruiter_candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("recruiter_candidates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    owner_role: Mapped[UserRole] = mapped_column(
        SqlEnum(
            UserRole,
            name="user_role",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
    )
    report_type: Mapped[ReportType] = mapped_column(
        SqlEnum(
            ReportType,
            name="report_type",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    payload_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    owner = relationship("User", back_populates="saved_reports")
    recruiter_job = relationship("RecruiterJob", back_populates="saved_reports")
    recruiter_candidate = relationship("RecruiterCandidate", back_populates="saved_reports")
