"""create saved reports table

Revision ID: 20260408_0007
Revises: 20260408_0006
Create Date: 2026-04-08 15:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260408_0007"
down_revision: Union[str, None] = "20260408_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


report_type = sa.Enum(
    "candidate_interview_questions",
    "candidate_answer_guidance",
    "candidate_star_answer",
    "candidate_skill_gap_analysis",
    "recruiter_fit_summary",
    "recruiter_interview_pack",
    name="report_type",
)


def upgrade() -> None:
    report_type.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "saved_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("owner_role", sa.Enum("candidate", "recruiter", "admin", name="user_role"), nullable=False),
        sa.Column("report_type", report_type, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("payload_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_reports_id"), "saved_reports", ["id"], unique=False)
    op.create_index(op.f("ix_saved_reports_owner_user_id"), "saved_reports", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_saved_reports_report_type"), "saved_reports", ["report_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_reports_report_type"), table_name="saved_reports")
    op.drop_index(op.f("ix_saved_reports_owner_user_id"), table_name="saved_reports")
    op.drop_index(op.f("ix_saved_reports_id"), table_name="saved_reports")
    op.drop_table("saved_reports")
    report_type.drop(op.get_bind(), checkfirst=True)
