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
    with op.batch_alter_table("saved_reports", schema=None) as batch_op:
        batch_op.add_column(sa.Column("recruiter_job_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("recruiter_candidate_id", sa.Integer(), nullable=True))
        batch_op.create_index(op.f("ix_saved_reports_recruiter_job_id"), ["recruiter_job_id"], unique=False)
        batch_op.create_index(
            op.f("ix_saved_reports_recruiter_candidate_id"),
            ["recruiter_candidate_id"],
            unique=False,
        )
        batch_op.create_foreign_key(
            "fk_saved_reports_recruiter_job_id",
            "recruiter_jobs",
            ["recruiter_job_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_saved_reports_recruiter_candidate_id",
            "recruiter_candidates",
            ["recruiter_candidate_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("saved_reports", schema=None) as batch_op:
        batch_op.drop_constraint("fk_saved_reports_recruiter_candidate_id", type_="foreignkey")
        batch_op.drop_constraint("fk_saved_reports_recruiter_job_id", type_="foreignkey")
        batch_op.drop_index(op.f("ix_saved_reports_recruiter_candidate_id"))
        batch_op.drop_index(op.f("ix_saved_reports_recruiter_job_id"))
        batch_op.drop_column("recruiter_candidate_id")
        batch_op.drop_column("recruiter_job_id")
