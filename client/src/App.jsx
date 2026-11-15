import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import Exercises from "./Exercises.jsx";
import Routines from "./Routines.jsx";
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
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const path = isRegistering ? "/register" : "/login";

    const body = isRegistering
      ? form
      : {
          username: form.username,
          password: form.password,
        };

    try {
      const user = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      onLogin(user);
      navigate("/exercises", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setIsRegistering(!isRegistering);
    setError("");
    setForm({
      username: "",
      email: "",
      password: "",
    });
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Let's Move</h1>
        <p>Your workout and movement journal.</p>

        <h2>
          {isRegistering ? "Create an account" : "Log in"}
        </h2>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            value={form.username}
            onChange={handleChange}
            required
            maxLength={80}
          />

          {isRegistering && (
            <>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                maxLength={120}
              />
            </>
          )}

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={isRegistering ? 8 : undefined}
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : isRegistering
                ? "Register"
                : "Log in"}
          </button>
        </form>

        <button
          type="button"
          className="text-button"
          onClick={switchMode}
        >
          {isRegistering
            ? "Already have an account? Log in"
            : "Don't have an account? Register"}
        </button>
      </div>
    </main>
  );
}


function Dashboard({ user, onLogout, children }) {
  const [error, setError] = useState("");

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
        <h1>Let's Move</h1>
        <button onClick={handleLogout}>Log out</button>
      </header>

      <main className="dashboard-content">
        <h2>Welcome, {user.username}!</h2>
        <p>Your movement journal is ready.</p>

        {error && <p className="error">{error}</p>}

        <nav
          className="dashboard-nav"
          aria-label="Let's Move sections"
        >
          <NavLink
            to="/exercises"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Exercises
          </NavLink>

          <NavLink
            to="/routines"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            Routines
          </NavLink>
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
        const currentUser = await apiRequest("/check_session");
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, []);

  if (loading) {
    return <p className="loading">Loading Let's Move...</p>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/exercises" replace />
          ) : (
            <AuthPage onLogin={setUser} />
          )
        }
      />

      <Route
        path="/exercises"
        element={
          user ? (
            <Dashboard
              user={user}
              onLogout={() => setUser(null)}
            >
              <Exercises />
            </Dashboard>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/routines"
        element={
          user ? (
            <Dashboard
              user={user}
              onLogout={() => setUser(null)}
            >
              <Routines />
            </Dashboard>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/"
        element={<Navigate to="/exercises" replace />}
      />

      <Route
        path="*"
        element={<Navigate to="/exercises" replace />}
      />
    </Routes>
  );
}


export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}