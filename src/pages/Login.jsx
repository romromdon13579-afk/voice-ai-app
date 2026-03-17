import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Login() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // login | forgot
  const [form, setForm] = useState({ email: "", password: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(getHebrewError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await resetPassword(resetEmail);
      setSuccess("קישור לאיפוס סיסמה נשלח לכתובת המייל שלך.");
    } catch (err) {
      setError(getHebrewError(err.code));
    } finally {
      setLoading(false);
    }
  }

  function getHebrewError(code) {
    const map = {
      "auth/user-not-found": "לא נמצא משתמש עם כתובת מייל זו.",
      "auth/wrong-password": "סיסמה שגויה.",
      "auth/invalid-email": "כתובת מייל לא תקינה.",
      "auth/too-many-requests": "יותר מדי ניסיונות. נסה שוב מאוחר יותר.",
      "auth/invalid-credential": "שם משתמש או סיסמה שגויים.",
    };
    return map[code] || "אירעה שגיאה. נסה שוב.";
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-icon">🪖</div>
          <h1>שבצ"ק שמירות</h1>
          <p>מערכת שיבוץ חיילים אוטומטית</p>
          <div style={{
            marginTop: 8, fontSize: "0.82rem", color: "var(--olive)",
            background: "var(--gray-100)", padding: "4px 12px",
            borderRadius: 20, display: "inline-block", fontWeight: 600
          }}>
            📅 {today}
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {mode === "login" ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">כתובת מייל / שם משתמש</label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">סיסמה</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? "מתחבר..." : "כניסה למערכת"}
            </button>

            <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.88rem" }}>
              <span
                style={{ color: "var(--olive)", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => setMode("forgot")}
              >
                שכחתי סיסמה
              </span>
              <span style={{ margin: "0 10px", color: "var(--gray-300)" }}>|</span>
              <Link
                to="/register"
                style={{ color: "var(--olive)", textDecoration: "underline" }}
              >
                אין לכם משתמש עדיין?
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <p style={{ marginBottom: 16, color: "var(--gray-700)", fontSize: "0.9rem" }}>
              הזן את כתובת המייל שלך ואנחנו נשלח לך קישור לאיפוס הסיסמה.
            </p>
            <div className="form-group">
              <label className="form-label">כתובת מייל</label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? "שולח..." : "שלח קישור לאיפוס"}
            </button>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <span
                style={{ color: "var(--olive)", cursor: "pointer", fontSize: "0.88rem", textDecoration: "underline" }}
                onClick={() => setMode("login")}
              >
                ← חזרה לכניסה
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
