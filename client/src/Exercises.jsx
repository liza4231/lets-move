import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const measurementFields = [
  { key: "sets", label: "Sets", step: "1", min: "1" },
  { key: "reps", label: "Reps", step: "1", min: "1" },
  { key: "weight", label: "Weight (lb)", step: "any", min: "0" },
  { key: "duration", label: "Duration (minutes)", step: "any", min: "0" },
  { key: "distance", label: "Distance (miles)", step: "any", min: "0" },
];

const emptyForm = {
  name: "",
  category: "",
  notes: "",
  track_sets: false,
  track_reps: false,
  track_weight: false,
  track_duration: false,
  track_distance: false,
  default_sets: "",
  default_reps: "",
  default_weight: "",
  default_duration: "",
  default_distance: "",
};

function normalizeName(value) {
  const name = value.trim().replace(/\s+/g, " ");
  return name ? name[0].toUpperCase() + name.slice(1) : "";
}

function normalizeCategory(value) {
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

  const target = event.target;

  if (target.tagName === "TEXTAREA" && !event.ctrlKey) {
    return;
  }

  if (
    target.tagName !== "INPUT" &&
    target.tagName !== "TEXTAREA"
  ) {
    return;
  }

  // Allow normal keyboard behavior for checkboxes.
  if (target.type === "checkbox") {
    return;
  }

  event.preventDefault();

  const form = event.currentTarget;

  const fields = [
    ...form.querySelectorAll("input, textarea, select"),
  ].filter((field) => !field.disabled);

  const index = fields.indexOf(target);

  const next =
    fields[index + 1] ||
    form.querySelector('button[type="submit"]');

  next?.focus();
}

async function exerciseRequest(path = "", options = {}) {
  const response = await fetch(`/api/exercises${path}`, {
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

function MeasurementFields({ form, setForm, disabled }) {
  function handleSelection(field) {
    const trackKey = `track_${field}`;
    const defaultKey = `default_${field}`;

    setForm((current) => {
      const selected = !current[trackKey];

      return {
        ...current,
        [trackKey]: selected,
        [defaultKey]: selected ? current[defaultKey] : "",
      };
    });
  }

  function handleDefaultChange(field, value) {
    setForm((current) => ({
      ...current,
      [`default_${field}`]: value,
    }));
  }

  return (
    <fieldset className="measurement-options" disabled={disabled}>
      <legend>Track Measurements (optional)</legend>

      {measurementFields.map((field) => {
        const selected = form[`track_${field.key}`];

        return (
          <div className="measurement-option" key={field.key}>
            <label className="measurement-checkbox">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => handleSelection(field.key)}
              />

              <span>{field.label}</span>
            </label>

            {selected && (
              <label className="measurement-default">
                Default (optional)

                <input
                  type="number"
                  min={field.min}
                  step={field.step}
                  value={form[`default_${field.key}`]}
                  onChange={(event) =>
                    handleDefaultChange(
                      field.key,
                      event.target.value
                    )
                  }
                  placeholder="No default"
                />
              </label>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

function ExerciseForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  isEditing,
  error,
}) {
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleBlur(event) {
    const { name, value } = event.target;

    if (name !== "name" && name !== "category") {
      return;
    }

    const normalized =
      name === "name"
        ? normalizeName(value)
        : normalizeCategory(value);

    setForm((current) => ({
      ...current,
      [name]: normalized,
    }));
  }

  const hasChanges = Object.entries(form).some(
    ([key, value]) =>
      key.startsWith("track_")
        ? value === true
        : value !== ""
  );

  function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      name: normalizeName(form.name),
      category: normalizeCategory(form.category),
      notes: form.notes,
    };

    for (const field of measurementFields) {
      const trackKey = `track_${field.key}`;
      const defaultKey = `default_${field.key}`;

      payload[trackKey] = form[trackKey];

      const value = form[defaultKey];

      payload[defaultKey] =
        form[trackKey] && value !== ""
          ? Number(value)
          : null;
    }

    onSubmit(payload);
  }

  return (
    <form
      className="exercise-form"
      onSubmit={handleSubmit}
      onKeyDown={handleFormKeyDown}
    >
      <label htmlFor={isEditing ? "edit-name" : "exercise-name"}>
        Name
      </label>

      <input
        id={isEditing ? "edit-name" : "exercise-name"}
        name="name"
        value={form.name}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={100}
        required
        placeholder="e.g. Squat or RDL"
      />

      <label
        htmlFor={isEditing ? "edit-category" : "exercise-category"}
      >
        Category (optional)
      </label>

      <input
        id={isEditing ? "edit-category" : "exercise-category"}
        name="category"
        value={form.category}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={50}
        placeholder="e.g. Strength - Upper Body"
      />

      <label htmlFor={isEditing ? "edit-notes" : "exercise-notes"}>
        Notes (optional)
      </label>

      <textarea
        id={isEditing ? "edit-notes" : "exercise-notes"}
        name="notes"
        value={form.notes}
        onChange={handleChange}
        rows={4}
        placeholder="Anything useful to remember"
      />

      <MeasurementFields
        form={form}
        setForm={setForm}
        disabled={saving}
      />

      {error && <p className="error">{error}</p>}

      <div className="exercise-actions">
        <button type="submit" disabled={saving}>
          {saving
            ? "Saving..."
            : isEditing
              ? "Save Changes"
              : "Add Exercise"}
        </button>

        {(isEditing || hasChanges) && (
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
function MeasurementSummary({ exercise }) {
  const selectedFields = measurementFields.filter(
    (field) => exercise[`track_${field.key}`]
  );

  if (selectedFields.length === 0) {
    return (
      <p className="no-measurements">
        No measurements selected.
      </p>
    );
  }

  function formatDefault(field, value) {
    if (value === null || value === undefined) {
      return "No default";
    }

    if (field === "weight") {
      return `${value} lb`;
    }

    if (field === "duration") {
      return `${value} min`;
    }

    if (field === "distance") {
      return `${value} mi`;
    }

    return value;
  }

  return (
    <div className="measurement-summary">
      <h5>Tracked Measurements</h5>

      <div className="measurement-summary-list">
        {selectedFields.map((field) => (
          <div
            className="measurement-summary-row"
            key={field.key}
          >
            <span>{field.label}</span>

            <span>
              {formatDefault(
                field.key,
                exercise[`default_${field.key}`]
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Exercises() {
  const navigate = useNavigate();

  const [exercises, setExercises] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [addError, setAddError] = useState("");
  const [listError, setListError] = useState("");
  const [editError, setEditError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadExercises() {
      try {
        const data = await exerciseRequest();
        setExercises(data);
      } catch (err) {
        setListError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadExercises();
  }, []);

  const categories = [
    ...new Set(
      exercises
        .map((exercise) =>
          normalizeCategory(exercise.category || "")
        )
        .filter(Boolean)
    ),
  ].sort();

  const activeFilter =
    categoryFilter === "All" ||
    categories.includes(categoryFilter)
      ? categoryFilter
      : "All";

  const filteredExercises = exercises.filter(
    (exercise) =>
      activeFilter === "All" ||
      normalizeCategory(exercise.category || "") === activeFilter
  );

  function resetAddForm() {
    setForm({ ...emptyForm });
    setAddError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ ...emptyForm });
    setEditError("");
  }

  function exerciseToForm(exercise) {
    const result = {
      name: exercise.name,
      category: exercise.category || "",
      notes: exercise.notes || "",
    };

    for (const field of measurementFields) {
      result[`track_${field.key}`] =
        exercise[`track_${field.key}`] || false;

      result[`default_${field.key}`] =
        exercise[`default_${field.key}`] ?? "";
    }

    return result;
  }

  async function handleAdd(payload) {
    setAddError("");
    setSaving(true);

    try {
      const newExercise = await exerciseRequest("", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setExercises((current) =>
        [...current, newExercise].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      resetAddForm();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(exercise) {
    setEditingId(exercise.id);
    setEditForm(exerciseToForm(exercise));
    setEditError("");
    setListError("");
  }

  async function handleSave(payload) {
    setEditError("");
    setSaving(true);

    try {
      const updatedExercise = await exerciseRequest(
        `/${editingId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      setExercises((current) =>
        current
          .map((exercise) =>
            exercise.id === editingId
              ? updatedExercise
              : exercise
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      if (
        activeFilter !== "All" &&
        normalizeCategory(
          updatedExercise.category || ""
        ) !== activeFilter
      ) {
        setCategoryFilter("All");
      }

      cancelEdit();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exercise) {
    if (!window.confirm(`Delete "${exercise.name}"?`)) {
      return;
    }

    setListError("");

    try {
      await exerciseRequest(`/${exercise.id}`, {
        method: "DELETE",
      });

      setExercises((current) =>
        current.filter((item) => item.id !== exercise.id)
      );

      if (editingId === exercise.id) {
        cancelEdit();
      }
    } catch (err) {
      setListError(err.message);
    }
  }

  return (
    <div className="exercises-layout">
      <section className="dashboard-card">
        <h3>Add Exercise</h3>

        <ExerciseForm
          form={form}
          setForm={setForm}
          onSubmit={handleAdd}
          onCancel={resetAddForm}
          saving={saving}
          isEditing={false}
          error={addError}
        />
      </section>

      <section className="dashboard-card">
        <div className="exercise-list-header">
          <h3>My Exercises</h3>

          <select
            aria-label="Filter exercises by category"
            value={activeFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              cancelEdit();
            }}
          >
            <option value="All">All Categories</option>

            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {listError && <p className="error">{listError}</p>}

        {loading ? (
          <p>Loading exercises...</p>
        ) : exercises.length === 0 ? (
          <p>No exercises yet. Add your first exercise.</p>
        ) : filteredExercises.length === 0 ? (
          <p>No exercises in this category.</p>
        ) : (
          <div className="exercise-list">
            {filteredExercises.map((exercise) => (
              <div
                className={`exercise-item ${
                  editingId === exercise.id ? "editing" : ""
                }`}
                key={exercise.id}
              >
                {editingId === exercise.id ? (
                  <>
                    <h4>Editing: {exercise.name}</h4>

                    <ExerciseForm
                      form={editForm}
                      setForm={setEditForm}
                      onSubmit={handleSave}
                      onCancel={cancelEdit}
                      saving={saving}
                      isEditing
                      error={editError}
                    />
                  </>
                ) : (
                  <>
                    <h4>{exercise.name}</h4>

                    {exercise.category && (
                      <p className="exercise-category">
                        {normalizeCategory(exercise.category)}
                      </p>
                    )}

                      {exercise.notes && <p>{exercise.notes}</p>}

                      <MeasurementSummary exercise={exercise} />

                      <div className="exercise-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => navigate(`/log-exercise/${exercise.id}`)}
                          disabled={saving}
                        >
                          Log Exercise
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleEdit(exercise)}
                          disabled={saving}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(exercise)}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}