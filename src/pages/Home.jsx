import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsForSoldier, getGroupsByCommander,
  getSchedulesForGroup
} from "../services/firestoreService.js";
import { useNotifications } from "../hooks/useNotifications.js";

export default function Home() {
  const { userProfile, currentUser, isCommander } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [todaySlots, setTodaySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );

  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  // Activate real-time notifications + pre-shift reminders
  useNotifications({ currentUser, userProfile, groups, todaySlots });

  useEffect(() => {
    loadData();
  }, [currentUser]);

  async function loadData() {
    try {
      setLoading(true);
      const fetchedGroups = isCommander
        ? await getGroupsByCommander(currentUser.uid)
        : await getGroupsForSoldier(currentUser.uid);
      setGroups(fetchedGroups);

      if (fetchedGroups.length > 0) {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end   = new Date(); end.setHours(23, 59, 59, 999);

        const allSlots = [];
        for (const g of fetchedGroups) {
          const slots = await getSchedulesForGroup(g.id, start, end);
          allSlots.push(...slots.map(s => ({ ...s, groupName: g.name })));
        }
        allSlots.sort((a, b) => {
          const ta = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.date + "T" + (a.startTimeStr || "00:00"));
          const tb = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date + "T" + (b.startTimeStr || "00:00"));
          return ta - tb;
        });
        setTodaySlots(allSlots);
      }
    } catch (err) {
      console.error("Error loading home data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  }

  const difficultyLabel = d => ["", "קל", "קל-בינוני", "בינוני", "קשה", "קשה מאוד"][d] || "";

  return (
    <div>
      {/* Notification permission banner */}
      {notifPermission === "default" && (
        <div className="alert alert-warning" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>🔔 אפשר התראות כדי לקבל תזכורות לפני משמרות והודעות חדשות.</span>
          <button className="btn btn-sm btn-primary" onClick={requestNotifPermission}>
            אפשר התראות
          </button>
        </div>
      )}

      {/* Greeting Banner */}
      <div className="greeting-banner">
        <div>
          <h1 style={{ color: "var(--white)", marginBottom: 4 }}>
            שלום, {userProfile?.displayName || userProfile?.username} 👋
          </h1>
          <div style={{ opacity: 0.85, fontSize: "0.95rem" }}>📅 {today}</div>
          <div style={{ marginTop: 8 }}>
            <span className="badge badge-yellow">
              {isCommander ? "🎖️ מפקד" : "👤 חייל"}
            </span>
            {groups.length > 0 && (
              <span className="badge badge-yellow" style={{ marginRight: 8 }}>
                📁 {groups[0]?.name}
              </span>
            )}
            {notifPermission === "granted" && (
              <span className="badge badge-olive" style={{ marginRight: 8 }}>
                🔔 התראות פעילות
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: "4rem", opacity: 0.3 }}>🪖</div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="quick-action-card" onClick={() => navigate("/schedule?period=day")}>
          <div className="quick-action-icon">📋</div>
          <div className="quick-action-title">שיבוץ קבוצתי ליממה הקרובה</div>
          <div className="quick-action-sub">תצוגת 24 שעות קדימה</div>
        </div>
        <div className="quick-action-card" onClick={() => navigate("/schedule?period=week")}>
          <div className="quick-action-icon">📅</div>
          <div className="quick-action-title">שיבוץ קבוצתי לשבוע הקרוב</div>
          <div className="quick-action-sub">תצוגת 7 ימים קדימה</div>
        </div>
        {isCommander && (
          <>
            <div className="quick-action-card" onClick={() => navigate("/files")}>
              <div className="quick-action-icon">📁</div>
              <div className="quick-action-title">ניהול קבצי שמירות</div>
              <div className="quick-action-sub">הגדרת משימות וחיילים</div>
            </div>
            <div className="quick-action-card" onClick={() => navigate("/send-message")}>
              <div className="quick-action-icon">✉️</div>
              <div className="quick-action-title">שליחת הודעה לחייל</div>
              <div className="quick-action-sub">תקשורת עם הצוות</div>
            </div>
          </>
        )}
      </div>

      {/* Today's Tasks */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>📋</span>
          <h2>המשימות שלי היום</h2>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : todaySlots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">😴</div>
            <h3>אין משימות מתוכננות להיום</h3>
            <p>תהנה מהחופש!</p>
            {isCommander && groups.length === 0 && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => navigate("/files/new")}
              >
                + צור קובץ שמירות ראשון
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>שם הפעילות</th>
                  <th>שעת התחלה</th>
                  <th>שעת סיום</th>
                  <th>מפקד הפעילות</th>
                  <th>שותפים</th>
                  <th>רמת קושי</th>
                </tr>
              </thead>
              <tbody>
                {todaySlots.map((slot, i) => (
                  <tr key={slot.id || i}>
                    <td><strong>{slot.taskName}</strong></td>
                    <td>{slot.startTimeStr || "—"}</td>
                    <td>{slot.endTimeStr || "—"}</td>
                    <td>{slot.commanderName || "—"}</td>
                    <td>
                      {slot.assignedSoldiers?.filter(s => s.id !== currentUser.uid)
                        .map(s => s.name).join(", ") || "—"}
                    </td>
                    <td>
                      <span className={`difficulty-badge diff-${slot.difficulty}`}>
                        {"⭐".repeat(slot.difficulty || 1)} {difficultyLabel(slot.difficulty)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Groups summary */}
      {groups.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: "1.4rem" }}>👥</span>
            <h2>הקבוצות שלי</h2>
          </div>
          {groups.map(g => (
            <div key={g.id} className="schedule-slot" style={{ cursor: "pointer" }}
              onClick={() => navigate(`/files?group=${g.id}`)}>
              <div className="schedule-time">📁</div>
              <div>
                <div className="schedule-task">{g.name}</div>
                <div className="schedule-soldiers">
                  {g.memberUids?.length || 0} חיילים • {isCommander ? "מפקד" : "חייל"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
