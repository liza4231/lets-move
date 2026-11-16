import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
const measurements = [
  { key: "sets", label: "Sets", unit: "" },
  { key: "reps", label: "Reps", unit: "" },
  { key: "weight", label: "Weight", unit: "lb" },
  { key: "duration", label: "Duration", unit: "min" },
  { key: "distance", label: "Distance", unit: "mi" },
];
function todayLocal() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
async function workoutRequest(path, options = {}) {
  const response = await fetch(`/api/workout-logs${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}
function emptyExerciseValues(exercises) {
  return exercises.map((exercise) => {
    const values = {
      exercise_id: exercise.exercise_id,
      name: exercise.name,
      tracked: exercise.tracked,
      notes: "",
    };
    for (const field of exercise.tracked) {
      values[field] = "";
    }
    return values;
  });
}
export default function LogRoutine({ embeddedRoutineId, onClose, onSaved, initialDate }) {
  const { routineId: routeRoutineId } = useParams();
  const routineId = embeddedRoutineId ?? routeRoutineId;
  const navigate = useNavigate();
  const [routine, setRoutine] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [logId, setLogId] = useState(null);
  const [performedOn, setPerformedOn] = useState(initialDate || todayLocal());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [savedRecord, setSavedRecord] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function loadRoutine() {
      try {
        const data = await workoutRequest(
          `/options/routine/${routineId}`
        );
        if (cancelled) {
          return;
        }
        setRoutine(data);
        if (data.unfinished_log_id) {
          const existing = await workoutRequest(
            `/${data.unfinished_log_id}`
          );
          if (cancelled) {
            return;
          }
          setLogId(existing.id);
          setPerformedOn(existing.performed_on);
          setNotes(existing.notes || "");
          setExercises(
            existing.exercises.map((exercise) => {
              const values = { ...exercise };
              for (const field of exercise.tracked) {
                values[field] = exercise[field] ?? "";
              }
              values.notes = exercise.notes || "";
              return values;
            })
          );
        } else {
          setExercises(emptyExerciseValues(data.exercises));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadRoutine();
    return () => {
      cancelled = true;
    };
  }, [routineId]);
  function updateExercise(exerciseId, field, value) {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.exercise_id === exerciseId
          ? { ...exercise, [field]: value }
          : exercise
      )
    );
    setConfirmAction(null);
  }
  function applyValues(source) {
    if (!routine) {
      return;
    }
    setExercises((current) =>
      current.map((exercise) => {
        const option = routine.exercises.find(
          (item) => item.exercise_id === exercise.exercise_id
        );
        let selected = null;
        if (source === "defaults") {
          selected = option?.defaults;
        }
        if (source === "previous") {
          selected = option?.previous;
        }
        const updated = { ...exercise };
        for (const field of exercise.tracked) {
          updated[field] = selected?.[field] ?? "";
        }
        return updated;
      })
    );
    setConfirmAction(null);
  }
  function hasMissingMeasurements() {
    return exercises.some((exercise) =>
      exercise.tracked.some(
        (field) =>
          exercise[field] === "" ||
          exercise[field] == null
      )
    );
  }
  function handleAction(action) {
    if (hasMissingMeasurements()) {
      setConfirmAction(action);
      return;
    }
    saveRoutine(action);
  }
  async function saveRoutine(action) {
    if (saving) {
      return;
    }
    setSaving(true);
    setError("");
    setConfirmAction(null);
    const payload = {
      performed_on: performedOn,
      status: action === "finish" ? "completed" : "in_progress",
      notes: notes.trim() || null,
      exercises: exercises.map((exercise) => {
        const values = {
          exercise_id: exercise.exercise_id,
          notes: exercise.notes?.trim() || null,
        };
        for (const field of exercise.tracked) {
          const value = exercise[field];
          values[field] =
            value === "" || value == null
              ? null
              : Number(value);
        }
        return values;
      }),
    };
    try {
      let result;
      if (logId) {
        result = await workoutRequest(`/${logId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        result = await workoutRequest("", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            kind: "routine",
            routine_id: Number(routineId),
          }),
        });
      }
      setLogId(result.id);
      setSavedRecord(result);
      setFinished(action === "finish");
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  if (loading) {
    return (
      <section className="dashboard-card">
        <p>Loading routine...</p>
      </section>
    );
  }
  if (!routine) {
    return (
      <section className="dashboard-card">
        <h3>Log Routine</h3>
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          className="secondary-button"
          onClick={() => onClose ? onClose() : navigate("/routines")}
        >
          Back to Routines
        </button>
      </section>
    );
  }
  if (saved && savedRecord) {
    return (
      <section className={onClose ? "embedded-log-form" : "dashboard-card log-exercise-card"}>
        <h3>
          {finished
            ? "Routine Finished"
            : "Routine Saved — Unfinished"}
        </h3>
        <h4>{routine.name}</h4>
        <p>Your workout information has been saved.</p>
        <div className="routine-list">
          {savedRecord.exercises.map((exercise) => (
            <div
              className="routine-card"
              key={exercise.exercise_id}
            >
              <h4>{exercise.name}</h4>
              {exercise.tracked.length === 0 ? (
                <p>No measurements tracked.</p>
              ) : (
                <p>
                  {exercise.tracked
                    .map((field) => {
                      const value = exercise[field] ?? "—";
                      const units = {
                        sets: "",
                        reps: "",
                        weight: " lb",
                        duration: " min",
                        distance: " mi",
                      };
                      const displayedValue =
                        value === "—"
                          ? value
                          : `${value}${units[field]}`;
                      return `${field}: ${displayedValue}`;
                    })
                    .join(" · ")}
                </p>
              )}
              {exercise.notes && (
                <p>{exercise.notes}</p>
              )}
            </div>
          ))}
        </div>
        {savedRecord.notes && (
          <div className="log-notes">
            <h4>Overall Workout Observations</h4>
            <p>{savedRecord.notes}</p>
          </div>
        )}
        <div className="exercise-actions">
          {!finished && (
            <button
              type="button"
              onClick={() => setSaved(false)}
            >
              Continue Editing
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() => onClose ? onClose() : navigate("/routines")}
          >
            Back to Routines
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className={onClose ? "embedded-log-form" : "dashboard-card log-exercise-card"}>
      <div className="log-exercise-header">
        <div>
          <h3>{logId ? "Continue Routine" : "Log Routine"}</h3>
          <h4>{routine.name}</h4>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onClose ? onClose() : navigate("/routines")}
        >
          Cancel
        </button>
      </div>
      <div className="log-value-options">
        <button
          type="button"
          className="secondary-button"
          onClick={() => applyValues("clear")}
        >
          Clear Values
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => applyValues("defaults")}
        >
          Saved Defaults
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => applyValues("previous")}
        >
          Previous Performance
        </button>
      </div>
      <div className="form-group">
        <label htmlFor="routine-date">
          Performance Date
        </label>
        <input
          id="routine-date"
          type="date"
          value={performedOn}
          onChange={(event) =>
            setPerformedOn(event.target.value)
          }
          required
        />
      </div>
      {exercises.length === 0 && (
        <p className="exercise-category">This routine has no exercises. Add an exercise with Duration or Distance tracking from the Routines section to record those measurements.</p>
      )}
      <div className="routine-list">
        {exercises.map((exercise) => (
          <div
            className="routine-card"
            key={exercise.exercise_id}
          >
            <h4>{exercise.name}</h4>
            {exercise.tracked.length === 0 ? (
              <p>No measurements selected.</p>
            ) : (
              <div className="log-measurements">
                {measurements
                  .filter((field) =>
                    exercise.tracked.includes(field.key)
                  )
                  .map((field) => (
                    <div
                      className="form-group"
                      key={field.key}
                    >
                      <label
                        htmlFor={`${exercise.exercise_id}-${field.key}`}
                      >
                        {field.label}
                        {field.unit ? ` (${field.unit})` : ""}
                      </label>
                      <input
                        id={`${exercise.exercise_id}-${field.key}`}
                        type="number"
                        min={
                          field.key === "sets" ||
                          field.key === "reps"
                            ? "1"
                            : "0"
                        }
                        step={
                          field.key === "sets" ||
                          field.key === "reps"
                            ? "1"
                            : "any"
                        }
                        value={exercise[field.key] ?? ""}
                        onChange={(event) =>
                          updateExercise(
                            exercise.exercise_id,
                            field.key,
                            event.target.value
                          )
                        }
                        placeholder="—"
                      />
                    </div>
                  ))}
              </div>
            )}
            <details className="log-notes">
              <summary>+ Notes</summary>
              <div className="form-group">
                <label
                  htmlFor={`notes-${exercise.exercise_id}`}
                >
                  Exercise Notes (Optional)
                </label>
                <textarea
                  id={`notes-${exercise.exercise_id}`}
                  rows={3}
                  value={exercise.notes || ""}
                  onChange={(event) =>
                    updateExercise(
                      exercise.exercise_id,
                      "notes",
                      event.target.value
                    )
                  }
                />
              </div>
            </details>
          </div>
        ))}
      </div>
      <details className="log-notes">
        <summary>+ Overall Workout Observations</summary>
        <div className="form-group">
          <label htmlFor="routine-notes">
            Overall Notes (Optional)
          </label>
          <textarea
            id="routine-notes"
            rows={4}
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Anything noteworthy about this workout..."
          />
        </div>
      </details>
      {error && <p className="error">{error}</p>}
      {confirmAction && (
        <div className="log-confirmation">
          <p>
            Some measurements are blank.
            Do you want to save this routine anyway?
          </p>
          <div className="exercise-actions">
            <button
              type="button"
              onClick={() => saveRoutine(confirmAction)}
              disabled={saving}
            >
              Save Anyway
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setConfirmAction(null)}
            >
              Keep Editing
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onClose ? onClose() : navigate("/routines")}
            >
              Discard
            </button>
          </div>
        </div>
      )}
      {!confirmAction && (
        <div className="exercise-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => handleAction("save")}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => handleAction("finish")}
            disabled={saving}
          >
            Finish
          </button>
        </div>
      )}
    </section>
  );
}
