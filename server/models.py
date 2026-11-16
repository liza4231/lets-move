from app import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    exercises = db.relationship(
        "Exercise",
        back_populates="user"
    )

    routines = db.relationship(
        "Routine",
        back_populates="user"
    )


class Exercise(db.Model):
    __tablename__ = "exercises"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    # Measurements selected for this exercise
    track_sets = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    track_reps = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    track_weight = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    track_duration = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    track_distance = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    # Optional standalone exercise defaults
    default_sets = db.Column(db.Integer, nullable=True)
    default_reps = db.Column(db.Integer, nullable=True)
    default_weight = db.Column(db.Float, nullable=True)
    default_duration = db.Column(db.Float, nullable=True)
    default_distance = db.Column(db.Float, nullable=True)

    user = db.relationship(
        "User",
        back_populates="exercises"
    )

    routine_exercises = db.relationship(
        "RoutineExercise",
        back_populates="exercise",
        cascade="all, delete-orphan"
    )


class Routine(db.Model):
    __tablename__ = "routines"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    user = db.relationship(
        "User",
        back_populates="routines"
    )

    routine_exercises = db.relationship(
        "RoutineExercise",
        back_populates="routine",
        cascade="all, delete-orphan"
    )


class RoutineExercise(db.Model):
    __tablename__ = "routine_exercises"

    id = db.Column(db.Integer, primary_key=True)

    routine_id = db.Column(
        db.Integer,
        db.ForeignKey("routines.id"),
        nullable=False
    )

    exercise_id = db.Column(
        db.Integer,
        db.ForeignKey("exercises.id"),
        nullable=False
    )

    position = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    # Optional routine-specific measurements
    sets = db.Column(db.Integer, nullable=True)
    reps = db.Column(db.Integer, nullable=True)
    weight = db.Column(db.Float, nullable=True)
    duration = db.Column(db.Float, nullable=True)
    distance = db.Column(db.Float, nullable=True)

    routine = db.relationship(
        "Routine",
        back_populates="routine_exercises"
    )

    exercise = db.relationship(
        "Exercise",
        back_populates="routine_exercises"
    )


class WorkoutLog(db.Model):
    __tablename__ = "workout_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    routine_id = db.Column(
        db.Integer,
        db.ForeignKey("routines.id", ondelete="SET NULL"),
        nullable=True
    )
    exercise_id = db.Column(
        db.Integer,
        db.ForeignKey("exercises.id", ondelete="SET NULL"),
        nullable=True
    )
    kind = db.Column(db.String(8), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    performed_on = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(11), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    exercises = db.Column(db.JSON, nullable=False)

    __table_args__ = (
        db.CheckConstraint(
            "kind IN ('exercise', 'routine')",
            name="ck_workout_logs_kind"
        ),
        db.CheckConstraint(
            "status = 'completed' OR (kind = 'routine' AND status = 'in_progress')",
            name="ck_workout_logs_status"
        ),
        db.Index(
            "uq_workout_logs_unfinished_routine",
            "user_id",
            "routine_id",
            unique=True,
            postgresql_where=db.text(
                "status = 'in_progress' AND routine_id IS NOT NULL"
            )
        ),
    )

class PlannedWorkout(db.Model):
    __tablename__ = "planned_workouts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    routine_id = db.Column(db.Integer, db.ForeignKey("routines.id", ondelete="CASCADE"), nullable=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey("exercises.id", ondelete="CASCADE"), nullable=True)
    scheduled_on = db.Column(db.Date, nullable=False, index=True)

    routine = db.relationship("Routine")
    exercise = db.relationship("Exercise")
