import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getSoldiersInGroup, updateSoldier, deleteSoldier, getTasksForGroup,
  getSchedulesForGroup, getHistoryForGroup
} from "../services/firestoreService.js";
import { addDays, startOfDay, format } from "date-fns";
import { Timestamp } from "firebase/firestore";

const DAY_LABELS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

export default function SoldierProfile() {
  const { soldierId } = useParams();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get("group");
  const navigate = useNavigate();
  const { isCommander } = useAuth();

  const [soldier, setSoldier] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const [preferences, setPreferences] = useState({});
  const [activeDays, setActiveDays] = useState([0,1,2,3,4,5,6]);
  const [active, setActive] = useState(true);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaves, setLeaves] = useState([]);

  useEffect(() => {
    loadData();
  }, [soldierId, groupId]);

  async function loadData() {
    if (!groupId) return;
    setLoading(true);
    try {
      const soldiers = await getSoldiersInGroup(groupId);
      const found = soldiers.find(s => s.id === soldierId);
      if (!found) { navigate(-1); return; }
      setSoldier(found);
      setPreferences(found.preferences || {});
      setActiveDays(found.activeDays || [0,1,2,3,4,5,6]);
      setActive(found.active !== false);
      setLeaves(found.leaves || []);

      const taskList = await getTasksForGroup(groupId);
      setTasks(taskList);

      // Compute stats from schedules
      const start = addDays(new Date(), -30);
      const end = new Date();
      const schedules = await getSchedulesForGroup(groupId, startOfDay(start), end);
      const soldierSchedules = schedules.filter(s =>
        s.assignedSoldiers?.some(a => a.id === soldierId)
      );

      const taskStats = {};
      taskList.forEach(t => { taskStats[t.id] = 0; });
      soldierSchedules.forEach(s => {
        if (taskStats[s.taskId] !== undefined) taskStats[s.taskId]++;
      });
      setStats(taskStats);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!groupId) return;
    setSaving(true);
    try {
      await updateSoldier(groupId, soldierId, {
        preferences,
        activeDays,
        active,
        leaves
      });
      setSuccess("הפרטים נשמרו בהצלחה!");
      setTimeout(() => setSuccess(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את ${soldier?.name} מהקבוצה?`)) return;
    await deleteSoldier(groupId, soldierId);
    navigate(`/files?group=${groupId}`);
  }

  function addLeave() {
    if (!leaveStart || !leaveEnd) return;
    if (new Date(leaveEnd) <= new Date(leaveStart)) {
      alert("תאריך הסיום חייב להיות אחרי תאריך ההתחלה.");
      return;
    }
    setLeaves([...leaves, { startDate: leaveStart, endDate: leaveEnd }]);
    setLeaveStart(""); setLeaveEnd("");
  }

  function removeLeave(idx) {
    setLeaves(leaves.filter((_, i) => i !== idx));
  }

  function toggleDay(day) {
    setActiveDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  if (loading) return <div className="card"><div className="loading-overlay"><div className="spinner" /></div></div>;
  if (!soldier) return null;

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="soldier-avatar" style={{ width: 60, height: 60, fontSize: "1.5rem" }}>
            {(soldier.name || "?")[0]}
          </div>
          <div>
            <h2>{soldier.name || soldier.displayName}</h2>
            {soldier.username && <p style={{ color: "var(--gray-500)" }}>@{soldier.username}</p>}
            <span className={`badge ${active ? "badge-success" : "badge-gray"}`}>
              {active ? "פעיל" : "לא פעיל"}
            </span>
          </div>
          <div style={{ marginRight: "auto" }}>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>
              🗑️ מחק מהקבוצה
            </button>
          </div>
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      {/* Status */}
      <div className="card">
        <div className="card-header"><span>⚙️</span><h3>הגדרות פעילות</h3></div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <span style={{ fontWeight: 600 }}>מצב:</span>
          <label className="toggle-switch">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
          <span>{active ? "פעיל" : "לא פעיל"}</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="form-label">ימי פעילות בשבוע</label>
          <div style={{ display: "flex", gap: 6 }}>
            {DAY_LABELS.map((d, di) => (
              <div
                key={di}
                className={`day-badge ${activeDays.includes(di) ? "selected" : ""}`}
                onClick={() => toggleDay(di)}
              >{d}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Preferences */}
      <div className="card">
        <div className="card-header"><span>⭐</span><h3>סדר עדיפות למשימות (1–5)</h3></div>
        <p style={{ color: "var(--gray-500)", fontSize: "0.85rem", marginBottom: 16 }}>
          5 = עדיפות גבוהה, 1 = עדיפות נמוכה
        </p>

        {tasks.map(task => (
          <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, fontWeight: 600 }}>{task.name}</div>
            <select
              className="form-select"
              style={{ width: 100 }}
              value={preferences[task.id] || 3}
              onChange={e => setPreferences({ ...preferences, [task.id]: Number(e.target.value) })}
            >
              {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <div style={{ color: "var(--gray-500)", fontSize: "0.82rem", minWidth: 80 }}>
              30 יום: {stats[task.id] || 0} פעמים
            </div>
          </div>
        ))}
      </div>

      {/* Leaves */}
      <div className="card">
        <div className="card-header"><span>🏖️</span><h3>חופשות / היעדרויות</h3></div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className="form-label">מתאריך</label>
            <input type="datetime-local" className="form-input" value={leaveStart}
              onChange={e => setLeaveStart(e.target.value)} style={{ width: 200 }} />
          </div>
          <div>
            <label className="form-label">עד תאריך</label>
            <input type="datetime-local" className="form-input" value={leaveEnd}
              onChange={e => setLeaveEnd(e.target.value)} style={{ width: 200 }} />
          </div>
          <button className="btn btn-outline" onClick={addLeave}>+ הוסף חופשה</button>
        </div>

        {leaves.length === 0 ? (
          <p style={{ color: "var(--gray-500)", fontSize: "0.85rem" }}>אין חופשות מוגדרות</p>
        ) : (
          <div>
            {leaves.map((l, i) => (
              <div key={i} className="schedule-slot" style={{ justifyContent: "space-between" }}>
                <div>
                  📅 {new Date(l.startDate).toLocaleString("he-IL")} — {new Date(l.endDate).toLocaleString("he-IL")}
                </div>
                <button className="icon-btn danger" onClick={() => removeLeave(i)}>🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 30-day stats */}
      <div className="card">
        <div className="card-header"><span>📊</span><h3>סטטיסטיקה — 30 יום אחרונים</h3></div>
        {tasks.map(t => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontWeight: 600 }}>{t.name}</span>
            <span className="badge badge-olive">{stats[t.id] || 0} שמירות</span>
          </div>
        ))}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--gray-200)", fontWeight: 700 }}>
          סה"כ: {Object.values(stats).reduce((a, b) => a + b, 0)} שמירות
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 20 }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>ביטול</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "שומר..." : "💾 שמור שינויים"}
        </button>
      </div>
    </div>
  );
}
