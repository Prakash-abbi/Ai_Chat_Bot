import { useState } from "react";
import { login, register, setToken } from "../api";

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await login({ email, password })
          : await register({ email, password });
      setToken(data.token);
      onAuthed?.(data.user);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authShell">
      <div className="authCard">
        <div className="authHeader">
          <div className="brand">AI Chat</div>
          <div className="subtitle">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </div>
        </div>

        <form onSubmit={submit} className="authForm">
          <label>
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>

          {error ? <div className="authError">{error}</div> : null}

          <button className="primaryBtn" disabled={loading} type="submit">
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>

        <div className="authFooter">
          {mode === "login" ? (
            <button className="linkBtn" onClick={() => setMode("register")}>
              Need an account? Register
            </button>
          ) : (
            <button className="linkBtn" onClick={() => setMode("login")}>
              Already have an account? Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

