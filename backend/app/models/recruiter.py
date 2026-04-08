from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class RecruiterJob(Base):
    __tablename__ = "recruiter_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    recruiter_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    seniority: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    skills_required: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    recruiter = relationship("User", back_populates="recruiter_jobs")
    candidates = relationship(
        "RecruiterCandidate",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="RecruiterCandidate.created_at.desc()",
    )
    documents = relationship(
        "Document",
        back_populates="recruiter_job",
        cascade="save-update",
        order_by="Document.created_at.desc()",
    )
    saved_reports = relationship(
        "SavedReport",
        back_populates="recruiter_job",
        cascade="save-update",
        order_by="SavedReport.created_at.desc()",
    )


class RecruiterCandidate(Base):
    __tablename__ = "recruiter_candidates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    recruiter_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey("recruiter_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    current_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    recruiter = relationship("User", back_populates="recruiter_candidates")
    job = relationship("RecruiterJob", back_populates="candidates")
    documents = relationship(
        "Document",
        back_populates="recruiter_candidate",
        cascade="save-update",
        order_by="Document.created_at.desc()",
    )
    saved_reports = relationship(
        "SavedReport",
        back_populates="recruiter_candidate",
        cascade="save-update",
        order_by="SavedReport.created_at.desc()",
    )
