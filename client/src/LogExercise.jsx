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

export default function LogExercise() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState(null);
  const [values, setValues] = useState({});
  const [performedOn, setPerformedOn] = useState(todayLocal());
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadExercise() {
      setLoading(true);
      setError("");

      try {
        const data = await workoutRequest(
          `/options/exercise/${exerciseId}`
        );

        if (cancelled) {
          return;
        }

        setExercise(data);

        const emptyValues = {};

        for (const item of data.exercises[0].tracked) {
          emptyValues[item] = "";
        }

        setValues(emptyValues);
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

    loadExercise();

    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  function applyValues(source) {
    if (!exercise) {
      return;
    }

    const selected = exercise.exercises[0];
    const nextValues = {};

    for (const field of selected.tracked) {
      nextValues[field] = source?.[field] ?? "";
    }

    setValues(nextValues);
    setShowConfirmation(false);
    setError("");
  }

  function handleChange(field, value) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setShowConfirmation(false);
  }

  function hasMissingMeasurements() {
    if (!exercise) {
      return false;
    }

    return exercise.exercises[0].tracked.some(
      (field) => values[field] === "" || values[field] == null
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (hasMissingMeasurements()) {
      setShowConfirmation(true);
      return;
    }

    saveExercise();
  }

  async function saveExercise() {
    if (!exercise || saving) {
      return;
    }

    setSaving(true);
    setError("");
    setShowConfirmation(false);

    try {
      const selected = exercise.exercises[0];

      const exerciseValues = {
        exercise_id: Number(exerciseId),
        notes: notes.trim() || null,
      };

      for (const field of selected.tracked) {
        const value = values[field];

        exerciseValues[field] =
          value === "" || value == null
            ? null
            : Number(value);
      }

      await workoutRequest("", {
        method: "POST",
        body: JSON.stringify({
          kind: "exercise",
          exercise_id: Number(exerciseId),
          performed_on: performedOn,
          notes: notes.trim() || null,
          exercises: [exerciseValues],
        }),
      });

      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="dashboard-card">
        <p>Loading exercise...</p>
      </section>
    );
  }

  if (!exercise) {
    return (
      <section className="dashboard-card">
        <h3>Log Exercise</h3>

        {error && <p className="error">{error}</p>}

        <button
        type="button"
        className="secondary-button"
        onClick={() => navigate("/exercises")}
        >
        Back to Exercises
        </button>
      </section>
    );
  }

  if (saved) {
    return (
      <section className="dashboard-card">
        <h3>Exercise Saved</h3>

        <p>
          Your {exercise.name} performance has been saved.
        </p>

        <button
        type="button"
        className="secondary-button"
        onClick={() => navigate("/exercises")}
        >
        Back to Exercises
        </button>
      </section>
    );
  }

  const selected = exercise.exercises[0];

  return (
    <section className="dashboard-card log-exercise-card">
      <div className="log-exercise-header">
        <div>
          <h3>Log Exercise</h3>
          <h4>{exercise.name}</h4>
        </div>

        <button
        type="button"
        className="secondary-button"
        onClick={() => navigate("/exercises")}
        >
        Cancel
        </button>
      </div>

      <div className="log-value-options">
        <button
          type="button"
          className="secondary-button"
          onClick={() => applyValues(null)}
        >
          Clear Values
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => applyValues(selected.defaults)}
        >
          Saved Defaults
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => applyValues(selected.previous)}
          disabled={!selected.previous}
        >
          Previous Performance
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="performed-on">
            Performance Date
          </label>

          <input
            id="performed-on"
            type="date"
            value={performedOn}
            onChange={(event) =>
              setPerformedOn(event.target.value)
            }
            required
          />
        </div>

        {selected.tracked.length === 0 ? (
          <p>
            No measurements are selected for this exercise.
            You can still save a performance.
          </p>
        ) : (
          <div className="log-measurements">
            {measurements
              .filter((field) =>
                selected.tracked.includes(field.key)
              )
              .map((field) => (
                <div className="form-group" key={field.key}>
                  <label htmlFor={`log-${field.key}`}>
                    {field.label}
                    {field.unit ? ` (${field.unit})` : ""}
                  </label>

                  <input
                    id={`log-${field.key}`}
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
                    value={values[field.key] ?? ""}
                    onChange={(event) =>
                      handleChange(
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
            <label htmlFor="exercise-log-notes">
              Exercise Notes (Optional)
            </label>

            <textarea
              id="exercise-log-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={4}
              placeholder="Anything noteworthy about this performance..."
            />
          </div>
        </details>

        {error && <p className="error">{error}</p>}

        {showConfirmation && (
          <div className="log-confirmation">
            <p>
              Some measurements are blank.
              Do you want to save this exercise anyway?
            </p>

            <div className="exercise-actions">
              <button
                type="button"
                onClick={saveExercise}
                disabled={saving}
              >
                Save Anyway
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowConfirmation(false)}
              >
                Keep Editing
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate("/exercises")}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {!showConfirmation && (
          <div className="exercise-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Exercise"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}