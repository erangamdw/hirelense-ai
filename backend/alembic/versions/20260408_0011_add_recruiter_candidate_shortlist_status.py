"""add recruiter candidate shortlist status

Revision ID: 20260408_0011
Revises: 20260408_0010
Create Date: 2026-04-08 00:11:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260408_0011"
down_revision: str | None = "20260408_0010"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


recruiter_candidate_status = sa.Enum(
    "under_review",
    "shortlisted",
    "declined",
    name="recruiter_candidate_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    recruiter_candidate_status.create(bind, checkfirst=True)
    with op.batch_alter_table("recruiter_candidates", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "shortlist_status",
                recruiter_candidate_status,
                nullable=False,
                server_default="under_review",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("recruiter_candidates", schema=None) as batch_op:
        batch_op.drop_column("shortlist_status")

    bind = op.get_bind()
    recruiter_candidate_status.drop(bind, checkfirst=True)
