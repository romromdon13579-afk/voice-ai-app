import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsByCommander, getGroupsForSoldier,
  getSoldiersInGroup, getSchedulesForGroup
} from "../services/firestoreService.js";
import { addDays, startOfDay, subDays, format } from "date-fns";

export default function HistoryReports() {
  const { currentUser, isCommander } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [soldiers, setSoldiers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("personal"); // personal | group | specific
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => { loadGroups(); }, [currentUser]);
  useEffect(() => {
    if (selectedGroup) {
      loadSoldiers();
      loadSchedules();
    }
  }, [selectedGroup, dateRange]);

  async function loadGroups() {
    setLoading(true);
    try {
      const g = isCommander
        ? await getGroupsByCommander(currentUser.uid)
        : await getGroupsForSoldier(currentUser.uid);
      setGroups(g);
      if (g.length > 0) setSelectedGroup(g[0]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSoldiers() {
    if (!selectedGroup) return;
    const s = await getSoldiersInGroup(selectedGroup.id);
    setSoldiers(s);
  }

  async function loadSchedules() {
    if (!selectedGroup) return;
    setLoading(true);
    try {
      const end = new Date();
      const start = subDays(end, dateRange);
      const data = await getSchedulesForGroup(selectedGroup.id, startOfDay(start), end);
      setSchedules(data);
    } finally {
      setLoading(false);
    }
  }

  function getFilteredSchedules() {
    if (viewMode === "personal") {
      return schedules.filter(s => s.assignedSoldiers?.some(a => a.id === currentUser.uid));
    }
    if (viewMode === "specific" && selectedSoldier) {
      return schedules.filter(s => s.assignedSoldiers?.some(a => a.id === selectedSoldier));
    }
    return schedules; // group
  }

  const filtered = getFilteredSchedules();

  function formatDate(s) {
    if (s.date) return new Date(s.date).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
    if (s.startTime?.toDate) return s.startTime.toDate().toLocaleDateString("he-IL");
    return "—";
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>📊</span>
          <h2>דיווחי עבר</h2>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <select
            className="form-select"
            style={{ width: "auto" }}
            value={selectedGroup?.id || ""}
            onChange={e => setSelectedGroup(groups.find(g => g.id === e.target.value))}
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <select
            className="form-select"
            style={{ width: "auto" }}
            value={dateRange}
            onChange={e => setDateRange(Number(e.target.value))}
          >
            <option value={7}>7 ימים אחרונים</option>
            <option value={14}>14 ימים אחרונים</option>
            <option value={30}>30 ימים אחרונים</option>
            <option value={90}>90 ימים אחרונים</option>
          </select>
        </div>

        {/* View Mode Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { key: "personal", label: "אישי 👤" },
            { key: "group", label: "קבוצתי 👥" },
            ...(isCommander ? [{ key: "specific", label: "חייל ספציפי 🔍" }] : [])
          ].map(mode => (
            <button
              key={mode.key}
              className={`btn btn-sm ${viewMode === mode.key ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode(mode.key)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {viewMode === "specific" && (
          <div style={{ marginTop: 12 }}>
            <select
              className="form-select"
              style={{ maxWidth: 250 }}
              value={selectedSoldier || ""}
              onChange={e => setSelectedSoldier(e.target.value)}
            >
              <option value="">בחר חייל...</option>
              {soldiers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3>
            {viewMode === "personal" ? "השמירות שלי" :
             viewMode === "specific" ? `שמירות — ${soldiers.find(s => s.id === selectedSoldier)?.name || ""}` :
             "שמירות הקבוצה"}
          </h3>
          <span className="badge badge-olive">{filtered.length} רשומות</span>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>אין רשומות לתצוגה</h3>
            <p>לא נמצאו שמירות בטווח התאריכים הנבחר</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>שעת התחלה</th>
                  <th>שעת סיום</th>
                  <th>שם עמדה</th>
                  <th>רמת קושי</th>
                  {viewMode !== "personal" && <th>חיילים</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((slot, i) => (
                  <tr key={i}>
                    <td>{formatDate(slot)}</td>
                    <td>{slot.startTimeStr || "—"}</td>
                    <td>{slot.endTimeStr || "—"}</td>
                    <td><strong>{slot.taskName}</strong></td>
                    <td>
                      <span className={`difficulty-badge diff-${slot.difficulty}`}>
                        {"★".repeat(slot.difficulty || 1)}
                      </span>
                    </td>
                    {viewMode !== "personal" && (
                      <td style={{ fontSize: "0.85rem", color: "var(--gray-500)" }}>
                        {slot.assignedSoldiers?.map(s => s.name).join(", ") || "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {!loading && filtered.length > 0 && (
        <div className="card">
          <div className="card-header"><span>📈</span><h3>סיכום</h3></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ textAlign: "center", padding: 16, background: "var(--gray-100)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--olive)" }}>{filtered.length}</div>
              <div style={{ color: "var(--gray-500)", fontSize: "0.85rem" }}>סה"כ שמירות</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--gray-100)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--olive)" }}>
                {Math.round(filtered.reduce((sum, s) => {
                  if (!s.startTimeStr || !s.endTimeStr) return sum;
                  const [sh, sm] = s.startTimeStr.split(":").map(Number);
                  const [eh, em] = s.endTimeStr.split(":").map(Number);
                  let h = (eh * 60 + em) - (sh * 60 + sm);
                  if (h < 0) h += 1440;
                  return sum + h / 60;
                }, 0))}
              </div>
              <div style={{ color: "var(--gray-500)", fontSize: "0.85rem" }}>שעות שמירה</div>
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "var(--gray-100)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--olive)" }}>
                {(filtered.reduce((sum, s) => sum + (s.difficulty || 1), 0) / filtered.length).toFixed(1)}
              </div>
              <div style={{ color: "var(--gray-500)", fontSize: "0.85rem" }}>ממוצע רמת קושי</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
