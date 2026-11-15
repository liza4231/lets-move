import { useState } from "react";

const measurementFields = [
  { key: "sets", label: "Sets", min: "1", step: "1" },
  { key: "reps", label: "Reps", min: "1", step: "1" },
  { key: "weight", label: "Weight (lb)", min: "0", step: "any" },
  {
    key: "duration",
    label: "Duration (minutes)",
    min: "0",
    step: "any",
  },
  {
    key: "distance",
    label: "Distance (miles)",
    min: "0",
    step: "any",
  },
];

function normalizeRoutineName(value) {
  return value
    .trim()
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, separator, letter) =>
      separator + letter.toUpperCase()
    );
}

function handleFormKeyDown(event) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) {
    return;
  }

  if (
    event.target.tagName === "TEXTAREA" &&
    !event.ctrlKey
  ) {
    return;
  }

  if (
    event.target.tagName !== "INPUT" &&
    event.target.tagName !== "TEXTAREA"
  ) {
    return;
  }

  event.preventDefault();

  const form = event.currentTarget;

  const fields = [
    ...form.querySelectorAll("input, textarea, select"),
  ].filter((field) => !field.disabled);

  const index = fields.indexOf(event.target);

  const next =
    fields[index + 1] ||
    form.querySelector('button[type="submit"]');

  next?.focus();
}

function createRoutineItem(exercise) {
  const item = {
    exercise_id: exercise.id,
  };

  for (const field of measurementFields) {
    item[field.key] = exercise[`track_${field.key}`]
      ? exercise[`default_${field.key}`] ?? ""
      : "";
  }

  return item;
}

function RoutineMeasurementInputs({
  item,
  exercise,
  onChange,
}) {
  const selectedFields = measurementFields.filter(
    (field) =>
      exercise?.[`track_${field.key}`] ||
      (item[field.key] !== "" &&
        item[field.key] !== null &&
        item[field.key] !== undefined)
  );

  if (selectedFields.length === 0) {
    return (
      <p className="no-measurements">
        No measurements selected for this exercise.
      </p>
    );
  }

  return (
    <div className="routine-number-fields">
      {selectedFields.map((field) => (
        <label key={field.key}>
          {field.label}

          <input
            type="number"
            min={field.min}
            step={field.step}
            value={item[field.key] ?? ""}
            onChange={(event) =>
              onChange(field.key, event.target.value)
            }
            placeholder="Optional"
          />
        </label>
      ))}
    </div>
  );
}

export default function RoutineForm({
  initial,
  availableExercises,
  onSave,
  onCancel,
}) {
  const [name, setName] = useState(initial.name);

  const [description, setDescription] = useState(
    initial.description || ""
  );

  const [items, setItems] = useState(
    initial.exercises.map((item) => ({
      exercise_id: item.exercise_id,
      sets: item.sets ?? "",
      reps: item.reps ?? "",
      weight: item.weight ?? "",
      duration: item.duration ?? "",
      distance: item.distance ?? "",
    }))
  );

  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(initial.id);

  const hasChanges =
    name !== "" ||
    description !== "" ||
    items.length > 0 ||
    selectedId !== "";

  const remainingExercises = availableExercises.filter(
    (exercise) =>
      !items.some((item) => item.exercise_id === exercise.id)
  );

  function addExercise() {
    if (!selectedId) return;

    const exercise = availableExercises.find(
      (entry) => entry.id === Number(selectedId)
    );

    if (!exercise) return;

    setItems((current) => [
      ...current,
      createRoutineItem(exercise),
    ]);

    setSelectedId("");
  }

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function removeExercise(index) {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function moveExercise(index, direction) {
    const nextIndex = index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= items.length
    ) {
      return;
    }

    setItems((current) => {
      const updated = [...current];

      [updated[index], updated[nextIndex]] = [
        updated[nextIndex],
        updated[index],
      ];

      return updated;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSaving(true);

    const payload = {
      name: normalizeRoutineName(name),
      description,

      exercises: items.map((item) => {
        const result = {
          exercise_id: item.exercise_id,
        };

        for (const field of measurementFields) {
          const value = item[field.key];

          result[field.key] =
            value === "" ||
            value === null ||
            value === undefined
              ? null
              : Number(value);
        }

        return result;
      }),
    };

    try {
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="routine-form"
      onSubmit={handleSubmit}
      onKeyDown={handleFormKeyDown}
    >
      <label htmlFor={`routine-name-${initial.id || "new"}`}>
        Name
      </label>

      <input
        id={`routine-name-${initial.id || "new"}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => setName(normalizeRoutineName(name))}
        maxLength={100}
        required
        placeholder="e.g. Lower Body - Glutes"
      />

      <label
        htmlFor={`routine-description-${initial.id || "new"}`}
      >
        Description (optional)
      </label>

      <textarea
        id={`routine-description-${initial.id || "new"}`}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={2}
        placeholder="What is this routine for?"
      />

      <label
        htmlFor={`routine-exercise-${initial.id || "new"}`}
      >
        Add Saved Exercises
      </label>

      <div className="routine-add-row">
        <select
          id={`routine-exercise-${initial.id || "new"}`}
          value={selectedId}
          onChange={(event) =>
            setSelectedId(event.target.value)
          }
        >
          <option value="">Select an exercise</option>

          {remainingExercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="secondary-button"
          onClick={addExercise}
          disabled={!selectedId || saving}
        >
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div className="routine-selected-list">
          {items.map((item, index) => {
            const exercise = availableExercises.find(
              (entry) => entry.id === item.exercise_id
            );

            return (
              <div
                className="routine-selected-item"
                key={item.exercise_id}
              >
                <div className="routine-item-header">
                  <strong>
                    {index + 1}.{" "}
                    {exercise?.name || "Exercise unavailable"}
                  </strong>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => removeExercise(index)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>

                <RoutineMeasurementInputs
                  item={item}
                  exercise={exercise}
                  onChange={(field, value) =>
                    updateItem(index, field, value)
                  }
                />

                <div className="routine-order-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving || index === 0}
                    onClick={() => moveExercise(index, -1)}
                  >
                    Move Up
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      saving ||
                      index === items.length - 1
                    }
                    onClick={() => moveExercise(index, 1)}
                  >
                    Move Down
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="routine-form-actions">
        <button type="submit" disabled={saving}>
          {saving
            ? "Saving..."
            : isEditing
              ? "Save Changes"
              : "Create Routine"}
        </button>

        {onCancel && (isEditing || hasChanges) && (
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}