from datetime import date
import math
import re

from flask import Flask, jsonify, request, session
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from sqlalchemy.exc import IntegrityError

from config import Config


app = Flask(__name__)
app.config.from_object(Config)

db = SQLAlchemy(app)
migrate = Migrate(app, db)
bcrypt = Bcrypt(app)

CORS(
    app,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    supports_credentials=True
)

from models import User, Exercise, Routine, RoutineExercise, WorkoutLog


# General helpers

def user_to_dict(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email
    }


MEASUREMENTS = {
    "sets": int,
    "reps": int,
    "weight": float,
    "duration": float,
    "distance": float,
}


def exercise_to_dict(exercise):
    result = {
        "id": exercise.id,
        "name": exercise.name,
        "category": exercise.category,
        "notes": exercise.notes,
    }

    for field in MEASUREMENTS:
        result[f"track_{field}"] = getattr(
            exercise, f"track_{field}"
        )

        result[f"default_{field}"] = getattr(
            exercise, f"default_{field}"
        )

    return result


def normalize_exercise_name(value):
    name = " ".join(value.split())
    return name[0].upper() + name[1:] if name else ""


def normalize_category(value):
    category = " ".join(value.split())
    category = re.sub(r"\s*-\s*", " - ", category)
    return category.title()


def exercise_name_exists(user_id, name, exclude_id=None):
    normalized_name = " ".join(name.split()).casefold()

    existing_exercises = db.session.execute(
        db.select(Exercise).filter_by(user_id=user_id)
    ).scalars().all()

    return any(
        exercise.id != exclude_id
        and " ".join(exercise.name.split()).casefold()
        == normalized_name
        for exercise in existing_exercises
    )


def validate_measurements(data):
    values = {}

    for field, field_type in MEASUREMENTS.items():
        track_key = f"track_{field}"
        default_key = f"default_{field}"

        selected = data.get(track_key, False)
        default = data.get(default_key)

        if not isinstance(selected, bool):
            return None, f"Invalid {field} selection"

        if default == "":
            default = None

        if not selected:
            default = None

        if default is not None:
            if isinstance(default, bool):
                return None, f"Invalid {field} value"

            if field_type is int:
                if type(default) is not int or default <= 0:
                    return None, (
                        f"{field.capitalize()} must be "
                        "a positive whole number"
                    )

            else:
                if (
                    not isinstance(default, (int, float))
                    or not math.isfinite(default)
                    or default < 0
                    or default > 100000
                ):
                    return None, f"Invalid {field} value"

        values[track_key] = selected
        values[default_key] = default

    return values, None


def current_user_id():
    user_id = session.get("user_id")

    if user_id is None or db.session.get(User, user_id) is None:
        return None

    return user_id


# General route

@app.route("/")
def index():
    return jsonify({"message": "Let's Move API is running"})


# Authentication routes

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if (
        not isinstance(username, str)
        or not isinstance(email, str)
        or not isinstance(password, str)
    ):
        return jsonify({"error": "All fields are required"}), 400

    username = username.strip()
    email = email.strip().lower()

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if (
        len(username) > 80
        or len(email) > 120
        or "@" not in email
    ):
        return jsonify({"error": "Invalid username or email"}), 400

    if len(password) < 8:
        return jsonify({
            "error": "Password must be at least 8 characters"
        }), 400

    if db.session.execute(
        db.select(User).filter_by(username=username)
    ).scalar_one_or_none():
        return jsonify({"error": "Username already exists"}), 409

    if db.session.execute(
        db.select(User).filter_by(email=email)
    ).scalar_one_or_none():
        return jsonify({"error": "Email already exists"}), 409

    password_hash = bcrypt.generate_password_hash(
        password
    ).decode("utf-8")

    user = User(
        username=username,
        email=email,
        password_hash=password_hash
    )

    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "Username or email already exists"
        }), 409

    session.clear()
    session["user_id"] = user.id

    return jsonify(user_to_dict(user)), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    username = data.get("username")
    password = data.get("password")

    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify({"error": "Username and password required"}), 400

    user = db.session.execute(
        db.select(User).filter_by(username=username.strip())
    ).scalar_one_or_none()

    if not user or not bcrypt.check_password_hash(
        user.password_hash, password
    ):
        return jsonify({"error": "Invalid credentials"}), 401

    session.clear()
    session["user_id"] = user.id

    return jsonify(user_to_dict(user)), 200


@app.route("/check_session", methods=["GET"])
def check_session():
    user_id = current_user_id()

    if user_id is None:
        session.clear()
        return jsonify({"error": "Not authorized"}), 401

    user = db.session.get(User, user_id)

    return jsonify(user_to_dict(user)), 200


@app.route("/logout", methods=["DELETE"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


# Exercise routes

@app.route("/exercises", methods=["GET", "POST"])
def exercises():
    user_id = current_user_id()

    if user_id is None:
        return jsonify({"error": "Not authorized"}), 401

    if request.method == "GET":
        user_exercises = db.session.execute(
            db.select(Exercise)
            .filter_by(user_id=user_id)
            .order_by(Exercise.name)
        ).scalars().all()

        return jsonify([
            exercise_to_dict(exercise)
            for exercise in user_exercises
        ]), 200

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    name = data.get("name")
    category = data.get("category", "")
    notes = data.get("notes", "")

    if (
        not isinstance(name, str)
        or not isinstance(category, str)
        or not isinstance(notes, str)
    ):
        return jsonify({"error": "Invalid exercise data"}), 400

    name = normalize_exercise_name(name)
    category = normalize_category(category)
    notes = notes.strip()

    if not name or len(name) > 100 or len(category) > 50:
        return jsonify({"error": "Invalid name or category"}), 400

    if exercise_name_exists(user_id, name):
        return jsonify({
            "error": (
                "You already have an exercise with this name. "
                "Edit the existing exercise instead."
            )
        }), 409

    measurements, error = validate_measurements(data)

    if error:
        return jsonify({"error": error}), 400

    exercise = Exercise(
        name=name,
        category=category or None,
        notes=notes or None,
        user_id=user_id,
        **measurements
    )

    db.session.add(exercise)
    db.session.commit()

    return jsonify(exercise_to_dict(exercise)), 201


@app.route("/exercises/<int:exercise_id>", methods=["PATCH", "DELETE"])
def exercise_detail(exercise_id):
    user_id = current_user_id()

    if user_id is None:
        return jsonify({"error": "Not authorized"}), 401

    exercise = db.session.execute(
        db.select(Exercise).filter_by(
            id=exercise_id,
            user_id=user_id
        )
    ).scalar_one_or_none()

    if exercise is None:
        return jsonify({"error": "Exercise not found"}), 404

    if request.method == "DELETE":
        db.session.delete(exercise)
        db.session.commit()
        return jsonify({"message": "Exercise deleted"}), 200

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    name = data.get("name", exercise.name)
    category = data.get("category", exercise.category or "")
    notes = data.get("notes", exercise.notes or "")

    if (
        not isinstance(name, str)
        or not isinstance(category, str)
        or not isinstance(notes, str)
    ):
        return jsonify({"error": "Invalid exercise data"}), 400

    name = normalize_exercise_name(name)
    category = normalize_category(category)
    notes = notes.strip()

    if not name or len(name) > 100 or len(category) > 50:
        return jsonify({"error": "Invalid name or category"}), 400

    if exercise_name_exists(user_id, name, exclude_id=exercise_id):
        return jsonify({
            "error": "You already have an exercise with this name. Edit the existing exercise instead."
        }), 409

    measurement_data = {}

    for field in MEASUREMENTS:
        measurement_data[f"track_{field}"] = data.get(
            f"track_{field}",
            getattr(exercise, f"track_{field}")
        )

        measurement_data[f"default_{field}"] = data.get(
            f"default_{field}",
            getattr(exercise, f"default_{field}")
        )

    measurements, error = validate_measurements(measurement_data)

    if error:
        return jsonify({"error": error}), 400

    exercise.name = name
    exercise.category = category or None
    exercise.notes = notes or None

    for field, value in measurements.items():
        setattr(exercise, field, value)

    db.session.commit()

    return jsonify(exercise_to_dict(exercise)), 200


# Routine helpers

def normalize_routine_name(value):
    return normalize_category(value)


def routine_name_exists(user_id, name, exclude_id=None):
    normalized_name = normalize_routine_name(name).casefold()

    existing_routines = db.session.execute(
        db.select(Routine).filter_by(user_id=user_id)
    ).scalars().all()

    return any(
        routine.id != exclude_id
        and normalize_routine_name(routine.name).casefold()
        == normalized_name
        for routine in existing_routines
    )


def routine_to_dict(routine):
    return {
        "id": routine.id,
        "name": routine.name,
        "description": routine.description,
        "exercises": [
            {
                "exercise_id": item.exercise_id,
                "name": item.exercise.name,
                "category": item.exercise.category,
                "sets": item.sets,
                "reps": item.reps,
                "weight": item.weight,
                "duration": item.duration,
                "distance": item.distance
            }
            for item in sorted(
                routine.routine_exercises,
                key=lambda item: item.position
            )
        ]
    }


def validate_routine(data, user_id):
    if not isinstance(data, dict):
        return None, "Invalid JSON body"

    name = data.get("name")
    description = data.get("description", "")
    exercises = data.get("exercises", [])

    if (
        not isinstance(name, str)
        or not isinstance(description, str)
        or not isinstance(exercises, list)
    ):
        return None, "Invalid routine data"

    name = normalize_routine_name(name)
    description = description.strip()

    if not name or len(name) > 100:
        return None, "Routine name must be 1 to 100 characters"

    if len(exercises) > 100:
        return None, "Too many exercises in routine"

    validated_exercises = []
    exercise_ids = set()

    for item in exercises:
        if not isinstance(item, dict):
            return None, "Invalid exercise entry"

        exercise_id = item.get("exercise_id")

        if type(exercise_id) is not int or exercise_id <= 0:
            return None, "Invalid exercise ID"

        if exercise_id in exercise_ids:
            return None, "An exercise can only appear once per routine"

        exercise_ids.add(exercise_id)

        values = {}

        for field in ("sets", "reps"):
            value = item.get(field)

            if value == "":
                value = None

            if value is not None:
                if type(value) is not int or value <= 0:
                    return None, f"{field.capitalize()} must be a positive whole number"

            values[field] = value

        for field in ("weight", "duration", "distance"):
            value = item.get(field)

            if value == "":
                value = None

            if value is not None:
                if (
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(value)
                    or not 0 <= value <= 100000
                ):
                    return None, (
                        f"{field.capitalize()} must be "
                        "a valid non-negative number"
                    )

            values[field] = value

        validated_exercises.append({
            "exercise_id": exercise_id,
            **values
        })

    if exercise_ids:
        owned_ids = set(
            db.session.execute(
                db.select(Exercise.id).where(
                    Exercise.user_id == user_id,
                    Exercise.id.in_(exercise_ids)
                )
            ).scalars().all()
        )

        if owned_ids != exercise_ids:
            return None, "One or more exercises were not found"

    return {
        "name": name,
        "description": description or None,
        "exercises": validated_exercises
    }, None


def set_routine_exercises(routine, exercises):
    routine.routine_exercises.clear()

    for position, item in enumerate(exercises):
        routine.routine_exercises.append(
            RoutineExercise(
                exercise_id=item["exercise_id"],
                position=position,
                sets=item["sets"],
                reps=item["reps"],
                weight=item["weight"],
                duration=item["duration"],
                distance=item["distance"]
            )
        )


# Routine routes

@app.route("/routines", methods=["GET", "POST"])
def routines():
    user_id = current_user_id()

    if user_id is None:
        return jsonify({"error": "Not authorized"}), 401

    if request.method == "GET":
        user_routines = db.session.execute(
            db.select(Routine)
            .filter_by(user_id=user_id)
            .order_by(Routine.name)
        ).scalars().all()

        return jsonify([
            routine_to_dict(routine)
            for routine in user_routines
        ]), 200

    data, error = validate_routine(
        request.get_json(silent=True),
        user_id
    )

    if error:
        return jsonify({"error": error}), 400

    if routine_name_exists(user_id, data["name"]):
        return jsonify({
            "error": "You already have a routine with this name. Please choose a different name."
        }), 409

    routine = Routine(
        name=data["name"],
        description=data["description"],
        user_id=user_id
    )

    set_routine_exercises(routine, data["exercises"])

    db.session.add(routine)
    db.session.commit()

    return jsonify(routine_to_dict(routine)), 201


@app.route("/routines/<int:routine_id>", methods=["PATCH", "DELETE"])
def routine_detail(routine_id):
    user_id = current_user_id()

    if user_id is None:
        return jsonify({"error": "Not authorized"}), 401

    routine = db.session.execute(
        db.select(Routine).filter_by(
            id=routine_id,
            user_id=user_id
        )
    ).scalar_one_or_none()

    if routine is None:
        return jsonify({"error": "Routine not found"}), 404

    if request.method == "DELETE":
        db.session.delete(routine)
        db.session.commit()
        return jsonify({"message": "Routine deleted"}), 200

    data, error = validate_routine(
        request.get_json(silent=True),
        user_id
    )

    if error:
        return jsonify({"error": error}), 400

    if routine_name_exists(
        user_id,
        data["name"],
        exclude_id=routine_id
    ):
        return jsonify({
            "error": "You already have a routine with this name. Please choose a different name."
        }), 409

    routine.name = data["name"]
    routine.description = data["description"]

    set_routine_exercises(routine, data["exercises"])

    db.session.commit()

    return jsonify(routine_to_dict(routine)), 200



# Workout logging
def workout_log_to_dict(log):
    return {
        "id": log.id,
        "kind": log.kind,
        "name": log.name,
        "exercise_id": log.exercise_id,
        "routine_id": log.routine_id,
        "performed_on": log.performed_on.isoformat(),
        "status": log.status,
        "notes": log.notes,
        "exercises": log.exercises,
    }


def find_workout_source(user_id, kind, source_id):
    model = Exercise if kind == "exercise" else Routine
    return model.query.filter_by(
        id=source_id,
        user_id=user_id
    ).first()


def workout_exercise_snapshot(exercise, routine_item=None):
    measurements = {}
    tracked = []

    for field in MEASUREMENTS:
        value = (
            getattr(exercise, f"default_{field}")
            if routine_item is None
            else getattr(routine_item, field)
        )

        measurements[field] = value

        if getattr(exercise, f"track_{field}") or value is not None:
            tracked.append(field)

    return {
        "exercise_id": exercise.id,
        "name": exercise.name,
        "tracked": tracked,
        "notes": None,
        **measurements,
    }


def workout_exercise_snapshots(kind, source):
    if kind == "exercise":
        return [workout_exercise_snapshot(source)]

    return [
        workout_exercise_snapshot(item.exercise, item)
        for item in sorted(
            source.routine_exercises,
            key=lambda item: item.position
        )
    ]


def clean_workout_notes(value):
    if value is None:
        return None

    if not isinstance(value, str):
        raise ValueError("Notes must be text")

    return value.strip() or None


def clean_workout_measurement(field, value, tracked):
    if value is None or value == "":
        return None

    label = field.capitalize()

    if not tracked:
        raise ValueError(
            f"{label} is not tracked for this exercise"
        )

    if MEASUREMENTS[field] is int:
        if type(value) is not int or not 0 < value <= 2147483647:
            raise ValueError(
                f"{label} must be a positive whole number"
            )

    elif (
        type(value) not in (int, float)
        or not 0 <= value <= 100000
    ):
        raise ValueError(
            f"{label} must be a number between 0 and 100000"
        )

    return value


def workout_values(data, kind, snapshots, existing_log=None):
    if not isinstance(data, dict):
        raise ValueError("Invalid JSON body")

    saved_date = (
        existing_log.performed_on.isoformat()
        if existing_log else None
    )

    raw_date = data.get("performed_on", saved_date)

    try:
        performed_on = date.fromisoformat(raw_date)
    except (TypeError, ValueError):
        raise ValueError(
            "Use YYYY-MM-DD for the workout date"
        ) from None

    if raw_date != performed_on.isoformat():
        raise ValueError(
            "Use YYYY-MM-DD for the workout date"
        )

    saved_status = (
        existing_log.status
        if existing_log else "completed"
    )

    status = data.get("status", saved_status)

    allowed_statuses = (
        ("completed", "in_progress")
        if kind == "routine"
        else ("completed",)
    )

    if status not in allowed_statuses:
        raise ValueError("Invalid workout status")

    saved_notes = (
        existing_log.notes
        if existing_log else None
    )

    notes = clean_workout_notes(
        data.get("notes", saved_notes)
    )

    updates = data.get("exercises", [])

    if not isinstance(updates, list):
        raise ValueError(
            "Workout exercises must be a list"
        )

    snapshots_by_id = {
        snapshot["exercise_id"]: dict(snapshot)
        for snapshot in snapshots
    }

    updated_ids = set()

    for update in updates:
        if not isinstance(update, dict):
            raise ValueError("Invalid workout exercise")

        exercise_id = update.get("exercise_id")

        if (
            type(exercise_id) is not int
            or exercise_id not in snapshots_by_id
        ):
            raise ValueError(
                "Exercise does not belong to this workout"
            )

        if exercise_id in updated_ids:
            raise ValueError(
                "Each exercise can only be updated once"
            )

        updated_ids.add(exercise_id)

        snapshot = snapshots_by_id[exercise_id]

        if "notes" in update:
            snapshot["notes"] = clean_workout_notes(
                update["notes"]
            )

        for field in MEASUREMENTS:
            if field in update:
                snapshot[field] = clean_workout_measurement(
                    field,
                    update[field],
                    field in snapshot["tracked"]
                )

    return {
        "performed_on": performed_on,
        "status": status,
        "notes": notes,
        "exercises": list(snapshots_by_id.values()),
    }


def find_unfinished_routine(user_id, routine_id):
    return WorkoutLog.query.filter_by(
        user_id=user_id,
        routine_id=routine_id,
        status="in_progress",
    ).first()


def unfinished_workout_response(log):
    return jsonify({
        "error": "This routine already has an unfinished workout",
        "unfinished_log_id": log.id,
    }), 409


@app.route(
    "/workout-logs/options/<kind>/<int:source_id>",
    methods=["GET"]
)
def workout_log_options(kind, source_id):
    user_id = current_user_id()

    if user_id is None:
        return jsonify({
            "error": "Not authorized"
        }), 401

    if kind not in ("exercise", "routine"):
        return jsonify({
            "error": "Workout source not found"
        }), 404

    source = find_workout_source(
        user_id,
        kind,
        source_id
    )

    if source is None:
        return jsonify({
            "error": "Workout source not found"
        }), 404

    logs = WorkoutLog.query.filter_by(
        user_id=user_id,
        kind=kind,
        **{f"{kind}_id": source_id}
    )

    previous_log = (
        logs.filter_by(status="completed")
        .order_by(
            WorkoutLog.performed_on.desc(),
            WorkoutLog.id.desc()
        )
        .first()
    )

    previous_exercises = (
        {
            entry["exercise_id"]: entry
            for entry in previous_log.exercises
        }
        if previous_log else {}
    )

    exercises = []

    for snapshot in workout_exercise_snapshots(
        kind,
        source
    ):
        tracked = snapshot["tracked"]

        previous = previous_exercises.get(
            snapshot["exercise_id"]
        )

        exercises.append({
            "exercise_id": snapshot["exercise_id"],
            "name": snapshot["name"],
            "tracked": tracked,
            "defaults": {
                field: snapshot[field]
                for field in tracked
            },
            "previous": (
                {
                    field: previous.get(field)
                    for field in tracked
                }
                if previous is not None
                else None
            ),
        })

    unfinished = (
        find_unfinished_routine(user_id, source_id)
        if kind == "routine"
        else None
    )

    return jsonify({
        "name": source.name,
        "exercises": exercises,
        "unfinished_log_id": (
            unfinished.id if unfinished else None
        ),
    }), 200


@app.route(
    "/workout-logs",
    methods=["GET", "POST"]
)
def workout_logs():
    user_id = current_user_id()

    if user_id is None:
        return jsonify({
            "error": "Not authorized"
        }), 401

    if request.method == "GET":
        logs = (
            WorkoutLog.query
            .filter_by(user_id=user_id)
            .order_by(
                WorkoutLog.performed_on.desc(),
                WorkoutLog.id.desc()
            )
            .all()
        )

        return jsonify([
            workout_log_to_dict(log)
            for log in logs
        ]), 200

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid JSON body"
        }), 400

    kind = data.get("kind")

    if kind not in ("exercise", "routine"):
        return jsonify({
            "error": "Workout type must be exercise or routine"
        }), 400

    source_key = f"{kind}_id"
    source_id = data.get(source_key)

    if (
        type(source_id) is not int
        or not 0 < source_id <= 2147483647
    ):
        return jsonify({
            "error": "Invalid workout source ID"
        }), 400

    source = find_workout_source(
        user_id,
        kind,
        source_id
    )

    if source is None:
        return jsonify({
            "error": "Workout source not found"
        }), 404

    if kind == "routine":
        unfinished = find_unfinished_routine(
            user_id,
            source_id
        )

        if unfinished is not None:
            return unfinished_workout_response(
                unfinished
            )

    try:
        values = workout_values(
            data,
            kind,
            workout_exercise_snapshots(kind, source)
        )
    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400

    log = WorkoutLog(
        user_id=user_id,
        kind=kind,
        name=source.name,
        **{source_key: source_id},
        **values,
    )

    db.session.add(log)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()

        if kind == "routine":
            unfinished = find_unfinished_routine(
                user_id,
                source_id
            )

            if unfinished is not None:
                return unfinished_workout_response(
                    unfinished
                )

        if find_workout_source(
            user_id,
            kind,
            source_id
        ) is None:
            return jsonify({
                "error": "Workout source not found"
            }), 404

        raise

    return jsonify(
        workout_log_to_dict(log)
    ), 201


@app.route(
    "/workout-logs/<int:log_id>",
    methods=["GET", "PATCH"]
)
def workout_log_detail(log_id):
    user_id = current_user_id()

    if user_id is None:
        return jsonify({
            "error": "Not authorized"
        }), 401

    query = WorkoutLog.query.filter_by(
        id=log_id,
        user_id=user_id
    )

    if request.method == "PATCH":
        query = query.with_for_update()

    log = query.first()

    if log is None:
        return jsonify({
            "error": "Workout log not found"
        }), 404

    if request.method == "GET":
        return jsonify(
            workout_log_to_dict(log)
        ), 200

    if log.status == "completed":
        return jsonify({
            "error": "This workout is already completed"
        }), 409

    try:
        values = workout_values(
            request.get_json(silent=True),
            log.kind,
            log.exercises,
            log
        )
    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400

    for field, value in values.items():
        setattr(log, field, value)

    db.session.commit()

    return jsonify(
        workout_log_to_dict(log)
    ), 200