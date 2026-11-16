import { useEffect, useState } from "react";

const measurementFields = [
  { key: "sets", label: "Sets", unit: "" },
  { key: "reps", label: "Reps", unit: "" },
  { key: "weight", label: "Weight", unit: " lb" },
  { key: "duration", label: "Duration", unit: " min" },
  { key: "distance", label: "Distance", unit: " mi" },
];

async function loadWorkoutHistory() {
  const response = await fetch("/api/workout-logs", {
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not load workout history");
  }
  return data;
}

function displayDate(date) {
  if (!date) return "No date";
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

export default function History() {
  const [workouts, setWorkouts] = useState([]);
  const [date, setDate] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const data = await loadWorkoutHistory();
        if (!cancelled) setWorkouts(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, []);

  const visibleWorkouts = workouts.filter(
    (workout) => !date || workout.performed_on === date
  );

  if (loading) return <p>Loading workout history...</p>;

  return (
    <section className="dashboard-card">
      <h3>Workout History</h3>
      <p>Review your saved workouts and observations.</p>

      <div className="history-filter">
        <label htmlFor="history-date">Filter by date</label>
        <input
          id="history-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        {date && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => setDate("")}
          >
            Show All
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {!error && visibleWorkouts.length === 0 && (
        <p>{date ? "No workouts saved for this date." : "No saved workouts yet."}</p>
      )}

      <div className="routine-list">
        {visibleWorkouts.map((workout) => {
          const isExpanded = expandedId === workout.id;
          return (
            <div
              className={`routine-card ${isExpanded ? "editing" : ""}`}
              key={workout.id}
            >
              <h4>{workout.name}</h4>
              <p className="exercise-category">
                {displayDate(workout.performed_on)} · {workout.status === "completed" ? "Completed" : "In Progress"}
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setExpandedId(isExpanded ? null : workout.id)}
              >
                {isExpanded ? "Hide Details" : "View Details"}
              </button>

              {isExpanded && (
                <div className="history-details">
                  {(workout.exercises || []).map((exercise, index) => (
                    <div className="routine-selected-item" key={`${exercise.exercise_id}-${index}`}>
                      <h4>{exercise.name}</h4>
                      {measurementFields
                        .filter((field) => (exercise.tracked || []).includes(field.key))
                        .map((field) => (
                          <p key={field.key}>
                            {field.label}: {exercise[field.key] == null ? "—" : `${exercise[field.key]}${field.unit}`}
                          </p>
                        ))}
                      {exercise.notes && <p>Notes: {exercise.notes}</p>}
                    </div>
                  ))}
                  {workout.notes && (
                    <div className="log-notes">
                      <h4>Overall Workout Observations</h4>
                      <p>{workout.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
