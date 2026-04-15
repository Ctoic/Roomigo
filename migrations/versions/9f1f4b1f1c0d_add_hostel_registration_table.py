"""Add hostel registration table

Revision ID: 9f1f4b1f1c0d
Revises: 358db374f8c2
Create Date: 2026-04-15 17:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f1f4b1f1c0d"
down_revision = "358db374f8c2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hostel_registration",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("emergency_contact", sa.String(length=20), nullable=False),
        sa.Column("emergency_contact_name", sa.String(length=100), nullable=False),
        sa.Column("university", sa.String(length=100), nullable=False),
        sa.Column("course", sa.String(length=100), nullable=False),
        sa.Column("year_of_study", sa.String(length=20), nullable=False),
        sa.Column("expected_duration", sa.String(length=50), nullable=False),
        sa.Column("special_requirements", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True, server_default="pending"),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("contacted_at", sa.DateTime(), nullable=True),
        sa.Column("contacted_by", sa.Integer(), sa.ForeignKey("admin.id"), nullable=True),
    )

    op.create_index(
        "ix_hostel_registration_email",
        "hostel_registration",
        ["email"],
        unique=False,
    )
    op.create_index(
        "ix_hostel_registration_status",
        "hostel_registration",
        ["status"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_hostel_registration_status", table_name="hostel_registration")
    op.drop_index("ix_hostel_registration_email", table_name="hostel_registration")
    op.drop_table("hostel_registration")
