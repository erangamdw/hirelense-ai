"""add document parsing fields

Revision ID: 20260408_0004
Revises: 20260408_0003
Create Date: 2026-04-08 07:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260408_0004"
down_revision: Union[str, None] = "20260408_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


document_parsing_status = sa.Enum(
    "pending",
    "succeeded",
    "failed",
    name="document_parsing_status",
)


def upgrade() -> None:
    document_parsing_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "documents",
        sa.Column("parsed_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column(
            "parsing_status",
            document_parsing_status,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "documents",
        sa.Column("parsing_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("parsed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("documents", "parsed_at")
    op.drop_column("documents", "parsing_error")
    op.drop_column("documents", "parsing_status")
    op.drop_column("documents", "parsed_text")
    document_parsing_status.drop(op.get_bind(), checkfirst=True)
