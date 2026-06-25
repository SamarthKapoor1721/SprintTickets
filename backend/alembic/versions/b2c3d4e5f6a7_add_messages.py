"""Add messages table for direct messaging

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-25 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_messages_id"), "messages", ["id"])
    op.create_index(op.f("ix_messages_sender_id"), "messages", ["sender_id"])
    op.create_index(op.f("ix_messages_recipient_id"), "messages", ["recipient_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_messages_recipient_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_sender_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_id"), table_name="messages")
    op.drop_table("messages")
