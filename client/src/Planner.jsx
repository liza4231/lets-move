import { useEffect, useState } from "react";
import LogRoutine from "./LogRoutine.jsx";
import LogExercise from "./LogExercise.jsx";

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function startOfWeek(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: "include", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function Planner() {
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [plans, setPlans] = useState([]);
  const [logs, setLogs] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [scheduleDate, setScheduleDate] = useState(selected);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const [planned, history, routineList, exerciseList] = await Promise.all([
        api("/planned-workouts"), api("/workout-logs"), api("/routines"), api("/exercises"),
      ]);
      setPlans(planned);
      setLogs(history);
      setRoutines(routineList);
      setExercises(exerciseList);
      setError("");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const today = dateKey(new Date());
  const weekStart = startOfWeek(parseDate(selected));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return { key: dateKey(date), number: date.getDate(), day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index] };
  });
  const selectedPlans = plans.filter((plan) => plan.scheduled_on === selected);
  const options = kind === "routine" ? routines : exercises;

  function selectDate(value) {
    setSelected(value);
    setScheduleDate(value);
    setExpanded(null);
  }
  function changeWeek(direction) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + direction * 7);
    selectDate(dateKey(next));
  }
  function reset() { selectDate(today); setShowCalendar(false); }
  function isComplete(plan) {
    return logs.some((log) => log.status === "completed" && log.performed_on === plan.scheduled_on &&
      (plan.kind === "routine" ? log.kind === "routine" && log.routine_id === plan.routine_id :
        log.kind === "exercise" && log.exercise_id === plan.exercise_id));
  }
  async function schedule(event) {
    event.preventDefault();
    if (!kind || !sourceId) return;
    setSaving(true);
    try {
      await api("/planned-workouts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, [`${kind}_id`]: Number(sourceId), scheduled_on: scheduleDate }),
      });
      selectDate(scheduleDate);
      setAdding(false); setKind(""); setSourceId("");
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  async function remove(plan) {
    if (!window.confirm(`Remove ${plan.name} from ${plan.scheduled_on}? This will not delete the ${plan.kind} or its history.`)) return;
    try {
      await api(`/planned-workouts/${plan.id}`, { method: "DELETE" });
      setExpanded(null);
      await refresh();
    } catch (err) { setError(err.message); }
  }
  function detail(plan) {
    return plan.kind === "routine" ? routines.find((r) => r.id === plan.routine_id) : exercises.find((e) => e.id === plan.exercise_id);
  }
  function showPanel(plan, action) {
    const value = `${plan.id}:${action}`;
    setExpanded((previous) => previous === value ? null : value);
  }

  return (
    <section className="dashboard-card planner">
      <h3>Weekly Planner</h3>
      <div className="planner-header">
        <strong>{weekStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
        <div className="planner-controls">
          <button type="button" className="secondary-button planner-icon" title="Previous week" aria-label="Previous week" onClick={() => changeWeek(-1)}>‹</button>
          <button type="button" className="secondary-button planner-icon" title="Next week" aria-label="Next week" onClick={() => changeWeek(1)}>›</button>
          <button type="button" className="secondary-button planner-icon" title="Choose a date" aria-label="Choose a date" onClick={() => setShowCalendar(!showCalendar)}>▦</button>
          <button type="button" className="secondary-button planner-icon" title="Return to today" aria-label="Return to today" onClick={reset}>↺</button>
        </div>
      </div>
      {showCalendar && <div className="planner-date-jump"><label htmlFor="planner-jump">Jump to date</label><input id="planner-jump" type="date" value={selected} onChange={(event) => { if (event.target.value) { selectDate(event.target.value); setShowCalendar(false); } }} /></div>}
      <div className="planner-week">
        {days.map((day) => (
          <button key={day.key} type="button" onClick={() => selectDate(day.key)}
            className={`planner-day ${day.key < today ? "past" : ""} ${day.key === today ? "today" : ""} ${selected === day.key ? "selected" : ""}`}>
            <span>{day.day}</span><strong>{day.number}</strong>
            {plans.some((p) => p.scheduled_on === day.key) && <span className="planner-dot" aria-label="Scheduled activity">●</span>}
          </button>
        ))}
      </div>
      <h4>{parseDate(selected).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h4>
      {error && <p className="error">{error}</p>}
      {loading ? <p>Loading planner...</p> : <>
        <h4>Planned Activities</h4>
        {selectedPlans.length === 0 && <p>No activities scheduled for this day.</p>}
        <div className="routine-list">
          {selectedPlans.map((plan) => {
            const item = detail(plan);
            const complete = isComplete(plan);
            return <div className="routine-card planner-activity" key={plan.id}>
              <div className="planner-activity-heading"><div><h4>{plan.name}</h4><span className="exercise-category">{plan.kind === "routine" ? "Routine" : "Exercise"} · {complete ? "Completed" : "Planned"}</span></div>
                <button type="button" className="secondary-button planner-icon" title="Remove from planner" aria-label={`Remove ${plan.name} from planner`} onClick={() => remove(plan)}>🗑</button></div>
              <div className="planner-actions">
                <button type="button" className="secondary-button" onClick={() => showPanel(plan, "view")}>{expanded === `${plan.id}:view` ? "Hide Details" : `View ${plan.kind === "routine" ? "Routine" : "Exercise"}`}</button>
                <button type="button" onClick={() => showPanel(plan, "log")}>{expanded === `${plan.id}:log` ? "Close Log" : "Log Workout"}</button>
              </div>
              {expanded === `${plan.id}:view` && <div className="planner-expanded">
                {item ? <>
                  {item.description && <p>{item.description}</p>}
                  {item.category && <p>Category: {item.category}</p>}
                  {plan.kind === "routine" ? (item.exercises.length ? item.exercises.map((exercise, index) => <div key={index} className="planner-detail-row"><strong>{exercise.name}</strong><span>{["sets", "reps", "weight", "duration", "distance"].filter((key) => exercise[key] !== null && exercise[key] !== undefined && exercise[key] !== "").map((key) => `${key}: ${exercise[key]}${key === "weight" ? " lb" : key === "duration" ? " min" : key === "distance" ? " mi" : ""}`).join(" · ")}</span></div>) : <p>No exercises in this routine yet.</p>) : <p>{item.notes || "No exercise notes."}</p>}
                </> : <p>This activity is no longer available in your library.</p>}
              </div>}
              {expanded === `${plan.id}:log` && (plan.kind === "routine" ?
                <LogRoutine key={`${plan.id}:routine`} embeddedRoutineId={plan.routine_id} initialDate={plan.scheduled_on} onClose={() => setExpanded(null)} onSaved={refresh} /> :
                <LogExercise key={`${plan.id}:exercise`} embeddedExerciseId={plan.exercise_id} initialDate={plan.scheduled_on} onClose={() => setExpanded(null)} onSaved={refresh} />)}
            </div>;
          })}
        </div>
        {!adding ? <button type="button" className="secondary-button planner-add" onClick={() => { setAdding(true); setScheduleDate(selected); }}>+ Schedule an Activity</button> :
          <form className="planner-add-form" onSubmit={schedule}>
            <div className="planner-activity-heading"><h4>Schedule an Activity</h4><button type="button" className="secondary-button planner-icon" aria-label="Cancel scheduling" onClick={() => { setAdding(false); setKind(""); setSourceId(""); }}>×</button></div>
            <div className="planner-actions">
              <button type="button" className="secondary-button" onClick={() => { setKind("routine"); setSourceId(""); }}>+ Schedule a Routine</button>
              <button type="button" className="secondary-button" onClick={() => { setKind("exercise"); setSourceId(""); }}>+ Schedule an Exercise</button>
            </div>
            {kind && <div className="planner-form-fields">
              <label htmlFor="planner-source">Select {kind}</label>
              <select id="planner-source" value={sourceId} onChange={(event) => setSourceId(event.target.value)} required><option value="">Choose {kind}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <label htmlFor="planner-date">Scheduled date</label>
              <input id="planner-date" type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} required />
              <button type="submit" disabled={!sourceId || saving}>{saving ? "Saving..." : "Save Activity"}</button>
            </div>}
          </form>}
      </>}
    </section>
  );
}
