"""add recruiter jobs and candidates

Revision ID: 20260408_0008
Revises: 20260408_0007
Create Date: 2026-04-08 00:08:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260408_0008"
down_revision: str | None = "20260408_0007"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recruiter_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recruiter_user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("seniority", sa.String(length=100), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("skills_required", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["recruiter_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recruiter_jobs_id"), "recruiter_jobs", ["id"], unique=False)
    op.create_index(
        op.f("ix_recruiter_jobs_recruiter_user_id"),
        "recruiter_jobs",
        ["recruiter_user_id"],
        unique=False,
    )

    op.create_table(
        "recruiter_candidates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recruiter_user_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("current_title", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["recruiter_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recruiter_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recruiter_candidates_email"), "recruiter_candidates", ["email"], unique=False)
    op.create_index(op.f("ix_recruiter_candidates_id"), "recruiter_candidates", ["id"], unique=False)
    op.create_index(op.f("ix_recruiter_candidates_job_id"), "recruiter_candidates", ["job_id"], unique=False)
    op.create_index(
        op.f("ix_recruiter_candidates_recruiter_user_id"),
        "recruiter_candidates",
        ["recruiter_user_id"],
        unique=False,
    )

    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.add_column(sa.Column("recruiter_job_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("recruiter_candidate_id", sa.Integer(), nullable=True))
        batch_op.create_index(op.f("ix_documents_recruiter_job_id"), ["recruiter_job_id"], unique=False)
        batch_op.create_index(
            op.f("ix_documents_recruiter_candidate_id"),
            ["recruiter_candidate_id"],
            unique=False,
        )
        batch_op.create_foreign_key(
            "fk_documents_recruiter_job_id",
            "recruiter_jobs",
            ["recruiter_job_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_documents_recruiter_candidate_id",
            "recruiter_candidates",
            ["recruiter_candidate_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.drop_constraint("fk_documents_recruiter_candidate_id", type_="foreignkey")
        batch_op.drop_constraint("fk_documents_recruiter_job_id", type_="foreignkey")
        batch_op.drop_index(op.f("ix_documents_recruiter_candidate_id"))
        batch_op.drop_index(op.f("ix_documents_recruiter_job_id"))
        batch_op.drop_column("recruiter_candidate_id")
        batch_op.drop_column("recruiter_job_id")

    op.drop_index(op.f("ix_recruiter_candidates_recruiter_user_id"), table_name="recruiter_candidates")
    op.drop_index(op.f("ix_recruiter_candidates_job_id"), table_name="recruiter_candidates")
    op.drop_index(op.f("ix_recruiter_candidates_id"), table_name="recruiter_candidates")
    op.drop_index(op.f("ix_recruiter_candidates_email"), table_name="recruiter_candidates")
    op.drop_table("recruiter_candidates")

    op.drop_index(op.f("ix_recruiter_jobs_recruiter_user_id"), table_name="recruiter_jobs")
    op.drop_index(op.f("ix_recruiter_jobs_id"), table_name="recruiter_jobs")
    op.drop_table("recruiter_jobs")
