"""Allow individual exercises in planned activities

Revision ID: 5c21e3b87a90
Revises: 2d776ae43e8c
"""
from alembic import op
import sqlalchemy as sa

revision = "5c21e3b87a90"
down_revision = "2d776ae43e8c"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("planned_workouts") as batch_op:
        batch_op.alter_column("routine_id", existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column("exercise_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_planned_workouts_exercise_id", "exercises", ["exercise_id"], ["id"], ondelete="CASCADE")
    op.create_check_constraint("ck_planned_workouts_one_source", "planned_workouts", "(routine_id IS NOT NULL AND exercise_id IS NULL) OR (routine_id IS NULL AND exercise_id IS NOT NULL)")


def downgrade():
    # Exercise-only plans cannot exist in the original schema.
    op.execute("DELETE FROM planned_workouts WHERE exercise_id IS NOT NULL")
    op.drop_constraint("ck_planned_workouts_one_source", "planned_workouts", type_="check")
    with op.batch_alter_table("planned_workouts") as batch_op:
        batch_op.drop_constraint("fk_planned_workouts_exercise_id", type_="foreignkey")
        batch_op.drop_column("exercise_id")
        batch_op.alter_column("routine_id", existing_type=sa.Integer(), nullable=False)
