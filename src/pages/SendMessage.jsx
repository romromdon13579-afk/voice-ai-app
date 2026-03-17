import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsByCommander, getGroupsForSoldier,
  getSoldiersInGroup, sendMessage
} from "../services/firestoreService.js";

const SUBJECTS = [
  { value: "reminder", label: "תזכורת" },
  { value: "personal", label: "אישי" },
  { value: "professional", label: "מקצועי" },
  { value: "release_request", label: "בקשת שחרור" },
  { value: "feedback", label: "ביקורת" },
  { value: "improvement", label: "הצעת ייעול" },
  { value: "other", label: "אחר" },
];

export default function SendMessage() {
  const { currentUser, userProfile, isCommander } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [soldiers, setSoldiers] = useState([]);
  const [form, setForm] = useState({
    subject: "professional",
    title: "",
    body: "",
    recipient: searchParams.get("to") || "all",
    customSubject: ""
  });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const now = new Date();

  useEffect(() => { loadGroups(); }, [currentUser]);
  useEffect(() => { if (selectedGroup) loadSoldiers(); }, [selectedGroup]);

  async function loadGroups() {
    const g = isCommander
      ? await getGroupsByCommander(currentUser.uid)
      : await getGroupsForSoldier(currentUser.uid);
    setGroups(g);
    if (g.length > 0) setSelectedGroup(g[0]);
  }

  async function loadSoldiers() {
    if (!selectedGroup) return;
    const s = await getSoldiersInGroup(selectedGroup.id);
    setSoldiers(s);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!selectedGroup || !form.title.trim() || !form.body.trim()) return;
    setSending(true);
    try {
      await sendMessage(selectedGroup.id, {
        subject: form.subject === "other" ? form.customSubject : SUBJECTS.find(s => s.value === form.subject)?.label,
        title: form.title,
        body: form.body,
        senderUid: currentUser.uid,
        senderName: userProfile?.displayName || "משתמש",
        recipientUid: form.recipient,
        groupId: selectedGroup.id,
        sentAt: now.toISOString()
      });
      setSuccess(true);
      setForm({ subject: "professional", title: "", body: "", recipient: "all", customSubject: "" });
      setTimeout(() => { setSuccess(false); navigate("/messages"); }, 2500);
    } catch (err) {
      console.error(err);
      alert("שגיאה בשליחת ההודעה.");
    } finally {
      setSending(false);
    }
  }

  const recipientName = form.recipient === "all"
    ? "כלל הקבוצה"
    : soldiers.find(s => s.id === form.recipient)?.name || "מפקד";

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>✉️</span>
          <h2>שליחת הודעה</h2>
        </div>

        {success && (
          <div className="alert alert-success">
            ✅ ההודעה נשלחה בהצלחה! מעביר לתיבת ההודעות...
          </div>
        )}

        <form onSubmit={handleSend}>
          {/* Group */}
          <div className="form-group">
            <label className="form-label">קבוצה</label>
            <select
              className="form-select"
              value={selectedGroup?.id || ""}
              onChange={e => setSelectedGroup(groups.find(g => g.id === e.target.value))}
            >
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {/* Recipient */}
          <div className="form-group">
            <label className="form-label">נמען</label>
            <select
              className="form-select"
              value={form.recipient}
              onChange={e => setForm({ ...form, recipient: e.target.value })}
            >
              {isCommander && <option value="all">📢 כלל הקבוצה</option>}
              {!isCommander && <option value="commander">🎖️ המפקד</option>}
              {soldiers.map(s => <option key={s.id} value={s.id}>👤 {s.name}</option>)}
            </select>
          </div>

          {/* Subject dropdown */}
          <div className="form-group">
            <label className="form-label">נושא שיחה</label>
            <select
              className="form-select"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
            >
              {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {form.subject === "other" && (
            <div className="form-group">
              <label className="form-label">נושא חופשי</label>
              <input
                className="form-input"
                placeholder="הזן נושא..."
                value={form.customSubject}
                onChange={e => setForm({ ...form, customSubject: e.target.value })}
              />
            </div>
          )}

          {/* Meta info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "var(--gray-100)", padding: 12, borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>שם שולח</div>
              <div style={{ fontWeight: 600 }}>{userProfile?.displayName}</div>
            </div>
            <div style={{ background: "var(--gray-100)", padding: 12, borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>תאריך</div>
              <div style={{ fontWeight: 600 }}>{now.toLocaleDateString("he-IL")}</div>
            </div>
            <div style={{ background: "var(--gray-100)", padding: 12, borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>שעה</div>
              <div style={{ fontWeight: 600 }}>{now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">הנדון</label>
            <input
              className="form-input"
              placeholder="נושא ההודעה"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          {/* Body */}
          <div className="form-group">
            <label className="form-label">תוכן ההודעה</label>
            <textarea
              className="form-textarea"
              placeholder="כתוב את תוכן ההודעה כאן..."
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              required
              style={{ minHeight: 140 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "var(--gray-500)", fontSize: "0.88rem" }}>
              ↗ ישלח ל: <strong>{recipientName}</strong>
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={sending}>
              {sending ? "שולח..." : "📨 שלח הודעה"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
