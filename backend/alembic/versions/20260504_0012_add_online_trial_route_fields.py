"""add route fields to online trial requests

Revision ID: 20260504_0012
Revises: 20260503_0011
Create Date: 2026-05-04
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260504_0012"
down_revision = "20260503_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("online_trial_requests", sa.Column("departure_station_id", sa.Integer(), nullable=True))
    op.add_column("online_trial_requests", sa.Column("arrival_station_id", sa.Integer(), nullable=True))
    op.add_column("online_trial_requests", sa.Column("departure_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("online_trial_requests", sa.Column("arrival_date", sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table("online_trial_requests") as batch_op:
        batch_op.create_foreign_key(
            "fk_online_trial_requests_departure_station_id",
            "stations",
            ["departure_station_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_online_trial_requests_arrival_station_id",
            "stations",
            ["arrival_station_id"],
            ["id"],
        )

    op.execute(
        """
        UPDATE online_trial_requests
        SET departure_station_id = station_id
        WHERE departure_station_id IS NULL
        """
    )

    with op.batch_alter_table("online_trial_requests") as batch_op:
        batch_op.alter_column("departure_station_id", existing_type=sa.Integer(), nullable=False)

    op.create_index(
        "ix_online_trial_requests_departure_station_id",
        "online_trial_requests",
        ["departure_station_id"],
        unique=False,
    )
    op.create_index(
        "ix_online_trial_requests_arrival_station_id",
        "online_trial_requests",
        ["arrival_station_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_online_trial_requests_arrival_station_id", table_name="online_trial_requests")
    op.drop_index("ix_online_trial_requests_departure_station_id", table_name="online_trial_requests")

    with op.batch_alter_table("online_trial_requests") as batch_op:
        batch_op.drop_constraint("fk_online_trial_requests_arrival_station_id", type_="foreignkey")
        batch_op.drop_constraint("fk_online_trial_requests_departure_station_id", type_="foreignkey")

    op.drop_column("online_trial_requests", "arrival_date")
    op.drop_column("online_trial_requests", "departure_date")
    op.drop_column("online_trial_requests", "arrival_station_id")
    op.drop_column("online_trial_requests", "departure_station_id")
