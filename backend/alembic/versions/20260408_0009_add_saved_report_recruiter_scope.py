"""add recruiter scope fields to saved reports

Revision ID: 20260408_0009
Revises: 20260408_0008
Create Date: 2026-04-08 00:09:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260408_0009"
down_revision: str | None = "20260408_0008"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("saved_reports", sa.Column("recruiter_job_id", sa.Integer(), nullable=True))
    op.add_column("saved_reports", sa.Column("recruiter_candidate_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_saved_reports_recruiter_job_id"), "saved_reports", ["recruiter_job_id"], unique=False)
    op.create_index(
        op.f("ix_saved_reports_recruiter_candidate_id"),
        "saved_reports",
        ["recruiter_candidate_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_saved_reports_recruiter_job_id",
        "saved_reports",
        "recruiter_jobs",
        ["recruiter_job_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_saved_reports_recruiter_candidate_id",
        "saved_reports",
        "recruiter_candidates",
        ["recruiter_candidate_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_saved_reports_recruiter_candidate_id", "saved_reports", type_="foreignkey")
    op.drop_constraint("fk_saved_reports_recruiter_job_id", "saved_reports", type_="foreignkey")
    op.drop_index(op.f("ix_saved_reports_recruiter_candidate_id"), table_name="saved_reports")
    op.drop_index(op.f("ix_saved_reports_recruiter_job_id"), table_name="saved_reports")
    op.drop_column("saved_reports", "recruiter_candidate_id")
    op.drop_column("saved_reports", "recruiter_job_id")
