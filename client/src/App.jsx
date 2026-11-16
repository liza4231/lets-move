import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Exercises from "./Exercises.jsx";
import Routines from "./Routines.jsx";
import LogExercise from "./LogExercise.jsx";
import LogRoutine from "./LogRoutine.jsx";
import History from "./History.jsx";
import Planner from "./Planner.jsx";
import "./App.css";

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

function AuthPage({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const path = isRegistering ? "/register" : "/login";
    const body = isRegistering
      ? form
      : { username: form.username, password: form.password };
    try {
      const user = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onLogin(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setIsRegistering(!isRegistering);
    setError("");
    setForm({ username: "", email: "", password: "" });
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Let's Move</h1>
        <p>Plan your activities and log your workouts.</p>
        <h2>{isRegistering ? "Create an account" : "Log in"}</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input id="username" name="username" value={form.username} onChange={handleChange} required maxLength={80} />
          {isRegistering && (
            <>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required maxLength={120} />
            </>
          )}
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" value={form.password} onChange={handleChange} required minLength={isRegistering ? 8 : undefined} />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : isRegistering ? "Register" : "Log in"}
          </button>
        </form>
        <button type="button" className="text-button" onClick={switchMode}>
          {isRegistering ? "Already have an account? Log in" : "Don't have an account? Register"}
        </button>
      </div>
    </main>
  );
}

function Dashboard({ user, onLogout, children }) {
  const [error, setError] = useState("");
  const [unfinished, setUnfinished] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    async function loadUnfinished() {
      try {
        const logs = await apiRequest("/workout-logs");
        if (!cancelled) {
          setUnfinished(logs.filter((log) => log.kind === "routine" && log.status === "in_progress"));
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    loadUnfinished();
    return () => { cancelled = true; };
  }, [location.pathname, refreshKey]);

  async function deleteUnfinished(workout) {
    if (!window.confirm(`Delete this unfinished workout? This cannot be undone. The original routine will remain.`)) return;
    setError("");
    try {
      await apiRequest(`/workout-logs/${workout.id}`, { method: "DELETE" });
      if (expandedId === workout.id) setExpandedId(null);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    setError("");
    try {
      await apiRequest("/logout", { method: "DELETE" });
      onLogout();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="dashboard">
      <header className="app-header">
        <h1><NavLink to="/" className="home-link">Let's Move</NavLink></h1>
        <button onClick={handleLogout}>Log out</button>
      </header>
      <main className="dashboard-content">
        <h2>Welcome, {user.username}!</h2>
        <p>Plan your activities and log your workouts.</p>
        {error && <p className="error">{error}</p>}

        {unfinished.length > 0 && (
          <section className="dashboard-card in-progress-section">
            <h3>In Progress</h3>
            <div className="in-progress-list">
              {unfinished.map((workout) => {
                const isExpanded = expandedId === workout.id;
                return (
                  <div key={workout.id} className={`in-progress-item ${isExpanded ? "expanded" : ""}`}>
                    <h4>{workout.routine_name || workout.name || "Routine"}</h4>
                    <p className="exercise-category">{workout.performed_on}</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setExpandedId(isExpanded ? null : workout.id)}
                    >
                      {isExpanded ? "Collapse Workout" : "Continue Workout"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => deleteUnfinished(workout)}
                    >
                      Delete Workout
                    </button>
                    {isExpanded && (
                      <LogRoutine
                        key={workout.id}
                        embeddedRoutineId={workout.routine_id}
                        onClose={() => setExpandedId(null)}
                        onSaved={() => setRefreshKey((current) => current + 1)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <nav className="dashboard-nav" aria-label="Let's Move sections">
          <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>Planner</NavLink>
          <NavLink to="/exercises" className={({ isActive }) => isActive ? "active" : ""}>Exercises</NavLink>
          <NavLink to="/routines" className={({ isActive }) => isActive ? "active" : ""}>Routines</NavLink>
          <NavLink to="/history" className={({ isActive }) => isActive ? "active" : ""}>History</NavLink>
        </nav>
        {children}
      </main>
    </div>
  );
}

function AppRoutes() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function checkSession() {
      try {
        setUser(await apiRequest("/check_session"));
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  if (loading) return <p className="loading">Loading Let's Move...</p>;

  const protectedPage = (component) => user ? (
    <Dashboard user={user} onLogout={() => setUser(null)}>{component}</Dashboard>
  ) : <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage onLogin={setUser} />} />
      <Route path="/" element={protectedPage(<Planner />)} />
      <Route path="/exercises" element={protectedPage(<Exercises />)} />
      <Route path="/routines" element={protectedPage(<Routines />)} />
      <Route path="/history" element={protectedPage(<History />)} />
      <Route path="/log-exercise/:exerciseId" element={protectedPage(<LogExercise />)} />
      <Route path="/log-routine/:routineId" element={protectedPage(<LogRoutine />)} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
