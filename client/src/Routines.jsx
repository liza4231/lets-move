import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RoutineForm from "./RoutineForm.jsx";

const emptyRoutine = {
  name: "",
  description: "",
  exercises: [],
};

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
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

export default function Routines() {
  const navigate = useNavigate();

  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [unfinishedRoutines, setUnfinishedRoutines] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [formKey, setFormKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [routineData, exerciseData, workoutData] =
          await Promise.all([
            apiRequest("/routines"),
            apiRequest("/exercises"),
            apiRequest("/workout-logs"),
          ]);

        setRoutines(routineData);
        setExercises(exerciseData);

        setUnfinishedRoutines(
          workoutData
            .filter(
              (workout) =>
                workout.kind === "routine" &&
                workout.status === "in_progress"
            )
            .map((workout) => workout.routine_id)
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function resetCreateForm() {
    setFormKey((current) => current + 1);
  }

  async function handleCreate(payload) {
    const routine = await apiRequest("/routines", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setRoutines((current) =>
      [...current, routine].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );

    resetCreateForm();
  }

  async function handleUpdate(id, payload) {
    const updated = await apiRequest(`/routines/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    setRoutines((current) =>
      current
        .map((routine) =>
          routine.id === id ? updated : routine
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    setEditingId(null);
  }

  async function handleDelete(routine) {
    if (!window.confirm(`Delete "${routine.name}"?`)) {
      return;
    }

    setError("");

    try {
      await apiRequest(`/routines/${routine.id}`, {
        method: "DELETE",
      });

      setRoutines((current) =>
        current.filter((item) => item.id !== routine.id)
      );

      if (editingId === routine.id) {
        setEditingId(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <p>Loading routines...</p>;
  }

  return (
    <div className="routines-layout">
      <section className="dashboard-card">
        <h3>Create Routine</h3>

        {exercises.length === 0 && (
          <p>
            You haven't saved any exercises yet.
            Add exercises in the Exercises section first.
          </p>
        )}

        <RoutineForm
          key={formKey}
          initial={emptyRoutine}
          availableExercises={exercises}
          onSave={handleCreate}
          onCancel={resetCreateForm}
        />
      </section>

      <section className="dashboard-card">
        <h3>My Routines</h3>

        {error && <p className="error">{error}</p>}

        {routines.length === 0 ? (
          <p>No routines yet. Create your first routine.</p>
        ) : (
          <div className="routine-list">
            {routines.map((routine) => {
              const isUnfinished =
                unfinishedRoutines.includes(routine.id);

              return (
                <div
                  key={routine.id}
                  className={`routine-card ${
                    editingId === routine.id ? "editing" : ""
                  }`}
                >
                  {editingId === routine.id ? (
                    <>
                      <h4>Editing: {routine.name}</h4>

                      <RoutineForm
                        key={routine.id}
                        initial={routine}
                        availableExercises={exercises}
                        onSave={(payload) =>
                          handleUpdate(routine.id, payload)
                        }
                        onCancel={() => setEditingId(null)}
                      />
                    </>
                  ) : (
                    <>
                      <h4>{routine.name}</h4>

                      {isUnfinished && (
                        <p className="exercise-category">
                          Unfinished workout saved
                        </p>
                      )}

                      {routine.description && (
                        <p>{routine.description}</p>
                      )}

                      {routine.exercises.length === 0 ? (
                        <p>No exercises added yet.</p>
                      ) : (
                        <ol className="routine-exercise-list">
                          {routine.exercises.map((item) => (
                            <li key={item.exercise_id}>
                              <strong>{item.name}</strong>

                              <span>
                                {[
                                  item.sets != null &&
                                    `${item.sets} sets`,
                                  item.reps != null &&
                                    `${item.reps} reps`,
                                  item.weight != null &&
                                    `${item.weight} lb`,
                                  item.duration != null &&
                                    `${item.duration} min`,
                                  item.distance != null &&
                                    `${item.distance} mi`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}

                      <div className="exercise-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            navigate(`/log-routine/${routine.id}`)
                          }
                        >
                          {isUnfinished
                            ? "Continue Workout"
                            : "Log Routine"}
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setEditingId(routine.id)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(routine)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}