"""add document indexing fields

Revision ID: 20260408_0006
Revises: 20260408_0005
Create Date: 2026-04-08 10:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260408_0006"
down_revision: Union[str, None] = "20260408_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


document_indexing_status = sa.Enum(
    "pending",
    "succeeded",
    "failed",
    name="document_indexing_status",
)


def upgrade() -> None:
    document_indexing_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "documents",
        sa.Column(
            "indexing_status",
            document_indexing_status,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "documents",
        sa.Column("indexing_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("indexed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("documents", "indexed_at")
    op.drop_column("documents", "indexing_error")
    op.drop_column("documents", "indexing_status")
    document_indexing_status.drop(op.get_bind(), checkfirst=True)
