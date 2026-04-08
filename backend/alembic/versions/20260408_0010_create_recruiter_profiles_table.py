"""create recruiter profiles table

Revision ID: 20260408_0010
Revises: 20260408_0009
Create Date: 2026-04-08 00:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260408_0010"
down_revision: str | None = "20260408_0009"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recruiter_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("recruiter_type", sa.String(length=100), nullable=False),
        sa.Column("organisation_size", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_recruiter_profiles_id"), "recruiter_profiles", ["id"], unique=False)
    op.create_index(op.f("ix_recruiter_profiles_user_id"), "recruiter_profiles", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_recruiter_profiles_user_id"), table_name="recruiter_profiles")
    op.drop_index(op.f("ix_recruiter_profiles_id"), table_name="recruiter_profiles")
    op.drop_table("recruiter_profiles")
