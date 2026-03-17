import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    displayName: "", username: "", email: "", password: "", confirmPassword: "",
    role: "soldier", idNumber: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      return setError("הסיסמאות אינן תואמות.");
    }
    if (form.password.length < 6) {
      return setError("הסיסמה חייבת להכיל לפחות 6 תווים.");
    }
    if (!form.username.trim()) {
      return setError("שם משתמש הוא שדה חובה.");
    }

    setLoading(true);
    try {
      await register(form.email, form.password, {
        displayName: form.displayName,
        username: form.username,
        role: form.role,
        idNumber: form.idNumber
      });
      navigate("/");
    } catch (err) {
      const map = {
        "auth/email-already-in-use": "כתובת המייל כבר בשימוש.",
        "auth/invalid-email": "כתובת מייל לא תקינה.",
        "auth/weak-password": "הסיסמה חלשה מדי.",
      };
      setError(map[err.code] || "אירעה שגיאה. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box" style={{ maxWidth: 480 }}>
        <div className="login-logo">
          <div className="login-logo-icon">🪖</div>
          <h1>פתיחת חשבון</h1>
          <p>הצטרפות למערכת שבצ"ק שמירות</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">שם מלא *</label>
              <input
                className="form-input"
                placeholder="ישראל ישראלי"
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">שם משתמש *</label>
              <input
                className="form-input"
                placeholder="israel123"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">תעודת זהות</label>
            <input
              className="form-input"
              placeholder="000000000"
              value={form.idNumber}
              onChange={e => setForm({ ...form, idNumber: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">כתובת מייל *</label>
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
            <label className="form-label">תפקיד</label>
            <select
              className="form-select"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            >
              <option value="soldier">חייל</option>
              <option value="commander">מפקד</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">סיסמה *</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">אימות סיסמה *</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                required
              />
            </div>
          </div>

          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
            {loading ? "יוצר חשבון..." : "יצירת חשבון"}
          </button>

          <div style={{ textAlign: "center", marginTop: 14, fontSize: "0.88rem" }}>
            כבר יש לך חשבון?{" "}
            <Link to="/login" style={{ color: "var(--olive)", textDecoration: "underline" }}>
              כניסה למערכת
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
