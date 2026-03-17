import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  createGroup, addSoldierToGroup, addTask,
  saveHistoricalData, getUserByUsername
} from "../services/firestoreService.js";
import { Timestamp } from "firebase/firestore";

const DAY_LABELS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const DEFAULT_TASKS = [
  { name: "ש\"ג", timeSlots: [{ start: "00:00", end: "04:00" }, { start: "04:00", end: "08:00" }, { start: "08:00", end: "12:00" }, { start: "12:00", end: "16:00" }, { start: "16:00", end: "20:00" }, { start: "20:00", end: "00:00" }], activeDays: [0,1,2,3,4,5,6], participantsNeeded: 2, difficulty: 3 },
  { name: "מטבח", timeSlots: [{ start: "06:00", end: "14:00" }], activeDays: [0,1,2,3,4,5,6], participantsNeeded: 3, difficulty: 2 },
  { name: "סיור א", timeSlots: [{ start: "00:00", end: "08:00" }, { start: "08:00", end: "16:00" }, { start: "16:00", end: "00:00" }], activeDays: [0,1,2,3,4,5,6], participantsNeeded: 4, difficulty: 4 },
  { name: "סיור ב", timeSlots: [{ start: "00:00", end: "08:00" }, { start: "08:00", end: "16:00" }, { start: "16:00", end: "00:00" }], activeDays: [0,1,2,3,4,5,6], participantsNeeded: 4, difficulty: 4 },
  { name: "יזומה", timeSlots: [{ start: "18:00", end: "04:00" }], activeDays: [0,1,2,3,4,5,6], participantsNeeded: 6, difficulty: 5 },
];

export default function CreateFile() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [fileName, setFileName] = useState("");
  const [tasks, setTasks] = useState(DEFAULT_TASKS.map((t, i) => ({ ...t, tempId: i })));

  // Step 2
  const [soldiers, setSoldiers] = useState([]);
  const [addMode, setAddMode] = useState("manual"); // "manual" | "username"
  const [newSoldierName, setNewSoldierName] = useState("");
  const [newSoldierUsername, setNewSoldierUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Step 3
  const [history, setHistory] = useState({});
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16));

  const [saving, setSaving] = useState(false);
  const [groupId, setGroupId] = useState(null);

  // ── Step 1: Tasks ─────────────────────────────────────────

  function addTask_local() {
    setTasks([...tasks, {
      tempId: Date.now(),
      name: "",
      timeSlots: [{ start: "00:00", end: "08:00" }],
      activeDays: [0,1,2,3,4,5,6],
      participantsNeeded: 2,
      difficulty: 3
    }]);
  }

  function updateTask_local(idx, field, val) {
    const updated = [...tasks];
    updated[idx] = { ...updated[idx], [field]: val };
    setTasks(updated);
  }

  function removeTask_local(idx) {
    setTasks(tasks.filter((_, i) => i !== idx));
  }

  function toggleTaskDay(taskIdx, day) {
    const t = tasks[taskIdx];
    const days = t.activeDays.includes(day)
      ? t.activeDays.filter(d => d !== day)
      : [...t.activeDays, day];
    updateTask_local(taskIdx, "activeDays", days);
  }

  function addTimeSlot(taskIdx) {
    const t = tasks[taskIdx];
    updateTask_local(taskIdx, "timeSlots", [...t.timeSlots, { start: "00:00", end: "08:00" }]);
  }

  function updateTimeSlot(taskIdx, slotIdx, field, val) {
    const t = tasks[taskIdx];
    const slots = [...t.timeSlots];
    slots[slotIdx] = { ...slots[slotIdx], [field]: val };
    updateTask_local(taskIdx, "timeSlots", slots);
  }

  function removeTimeSlot(taskIdx, slotIdx) {
    const t = tasks[taskIdx];
    updateTask_local(taskIdx, "timeSlots", t.timeSlots.filter((_, i) => i !== slotIdx));
  }

  // ── Step 2: Soldiers ──────────────────────────────────────

  function addSoldierManual() {
    if (!newSoldierName.trim()) return;
    setSoldiers([...soldiers, {
      tempId: Date.now(),
      name: newSoldierName.trim(),
      displayName: newSoldierName.trim(),
      activeDays: [0,1,2,3,4,5,6],
      uid: null,
      type: "manual"
    }]);
    setNewSoldierName("");
  }

  async function addSoldierByUsername() {
    if (!newSoldierUsername.trim()) return;
    setUsernameError("");
    setUsernameLoading(true);
    try {
      const user = await getUserByUsername(newSoldierUsername.trim());
      if (!user) {
        setUsernameError("שם משתמש לא נמצא במערכת.");
        return;
      }
      if (soldiers.some(s => s.uid === user.id)) {
        setUsernameError("החייל כבר נוסף לרשימה.");
        return;
      }
      setSoldiers([...soldiers, {
        tempId: Date.now(),
        name: user.displayName || newSoldierUsername.trim(),
        displayName: user.displayName || newSoldierUsername.trim(),
        activeDays: [0,1,2,3,4,5,6],
        uid: user.id,
        username: newSoldierUsername.trim(),
        type: "registered"
      }]);
      setNewSoldierUsername("");
    } catch {
      setUsernameError("שגיאה בחיפוש משתמש.");
    } finally {
      setUsernameLoading(false);
    }
  }

  function removeSoldier(idx) {
    setSoldiers(soldiers.filter((_, i) => i !== idx));
  }

  function toggleSoldierDay(soldierIdx, day) {
    const s = [...soldiers];
    const days = s[soldierIdx].activeDays.includes(day)
      ? s[soldierIdx].activeDays.filter(d => d !== day)
      : [...s[soldierIdx].activeDays, day];
    s[soldierIdx] = { ...s[soldierIdx], activeDays: days };
    setSoldiers(s);
  }

  // ── Step 3: History ───────────────────────────────────────

  function setHistoryValue(soldierId, taskIdx, value) {
    setHistory(prev => ({
      ...prev,
      [`${soldierId}_${taskIdx}`]: Number(value)
    }));
  }

  // ── Save ──────────────────────────────────────────────────

  async function handleSave() {
    if (!fileName.trim()) return alert("הזן שם לקובץ.");
    setSaving(true);
    try {
      // Create group
      const gid = await createGroup({
        name: fileName,
        commanderUid: currentUser.uid,
        commanderName: userProfile?.displayName || "מפקד",
        startDate: Timestamp.fromDate(new Date(startDate)),
        memberUids: [currentUser.uid]
      });
      setGroupId(gid);

      // Add tasks
      for (const task of tasks) {
        if (!task.name.trim()) continue;
        await addTask(gid, {
          name: task.name,
          timeSlots: task.timeSlots,
          activeDays: task.activeDays,
          participantsNeeded: task.participantsNeeded,
          difficulty: task.difficulty
        });
      }

      // Add soldiers
      for (const soldier of soldiers) {
        await addSoldierToGroup(gid, {
          name: soldier.name,
          displayName: soldier.displayName || soldier.name,
          activeDays: soldier.activeDays,
          active: true,
          uid: soldier.uid || null,
          ...(soldier.username ? { username: soldier.username } : {})
        });
      }

      // Save history
      const historyRows = [];
      soldiers.forEach((s, si) => {
        tasks.forEach((t, ti) => {
          const key = `${s.tempId}_${ti}`;
          const count = history[key] || 0;
          if (count > 0) {
            historyRows.push({
              soldierId: s.tempId.toString(),
              soldierName: s.name,
              taskName: t.name,
              difficulty: t.difficulty,
              count,
              hours: count * 4,
              isHistorical: true
            });
          }
        });
      });
      if (historyRows.length > 0) {
        await saveHistoricalData(gid, historyRows);
      }

      alert("הכל מוכן! הקובץ נשמר בהצלחה 🎉");
      navigate(`/files?group=${gid}`);
    } catch (err) {
      console.error(err);
      alert("שגיאה בשמירת הקובץ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>📁</span>
          <h2>בניית קובץ שמירות חדש</h2>
        </div>

        {/* Wizard Steps */}
        <div className="wizard-steps">
          {["הגדרת משימות", "הוספת חיילים", "היסטוריה ראשונית"].map((label, i) => (
            <React.Fragment key={i}>
              <div className={`wizard-step ${step === i+1 ? "active" : step > i+1 ? "done" : ""}`}>
                <div className="wizard-step-num">{step > i+1 ? "✓" : i+1}</div>
                <div className="wizard-step-label">{label}</div>
              </div>
              {i < 2 && <div className="wizard-connector" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Step 1: Tasks ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>שלב א׳ — הגדרת משימות</h3>

          <div className="form-group">
            <label className="form-label">שם הקובץ *</label>
            <input
              className="form-input"
              placeholder="לדוגמה: פלוגה א׳ — ינואר 2025"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12, fontWeight: 700, color: "var(--primary)" }}>
            רשימת משימות
          </div>

          {tasks.map((task, ti) => (
            <div key={task.tempId} className="card" style={{ background: "var(--gray-100)", border: "1px solid var(--gray-200)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <input
                  className="form-input"
                  placeholder="שם המשימה"
                  value={task.name}
                  onChange={e => updateTask_local(ti, "name", e.target.value)}
                  style={{ maxWidth: 200, fontWeight: 700 }}
                />
                <button className="icon-btn danger" onClick={() => removeTask_local(ti)}>🗑️</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">כמות משתתפים</label>
                  <input
                    type="number" min="1" max="20"
                    className="form-input"
                    value={task.participantsNeeded}
                    onChange={e => updateTask_local(ti, "participantsNeeded", Number(e.target.value))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">רמת קושי (1–5)</label>
                  <select
                    className="form-select"
                    value={task.difficulty}
                    onChange={e => updateTask_local(ti, "difficulty", Number(e.target.value))}
                  >
                    {[1,2,3,4,5].map(d => <option key={d} value={d}>{d} — {["","קל","קל-בינוני","בינוני","קשה","קשה מאוד"][d]}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label className="form-label">ימי פעילות</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {DAY_LABELS.map((d, di) => (
                    <div
                      key={di}
                      className={`day-badge ${task.activeDays.includes(di) ? "selected" : ""}`}
                      onClick={() => toggleTaskDay(ti, di)}
                    >{d}</div>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">טווחי שעות</label>
                {task.timeSlots.map((slot, si) => (
                  <div key={si} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input type="time" className="form-input" value={slot.start}
                      onChange={e => updateTimeSlot(ti, si, "start", e.target.value)}
                      style={{ width: 120 }} />
                    <span>—</span>
                    <input type="time" className="form-input" value={slot.end}
                      onChange={e => updateTimeSlot(ti, si, "end", e.target.value)}
                      style={{ width: 120 }} />
                    <button className="icon-btn danger" onClick={() => removeTimeSlot(ti, si)}>✕</button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => addTimeSlot(ti)}>+ הוסף טווח שעות</button>
              </div>
            </div>
          ))}

          <button className="btn btn-outline" onClick={addTask_local} style={{ marginBottom: 16 }}>
            + הוסף משימה
          </button>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!fileName.trim()}>
              הבא ← שלב ב׳
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Soldiers ──────────────────────────────────────── */}
      {step === 2 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>שלב ב׳ — הוספת חיילים לקבוצה</h3>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              className={`btn btn-sm ${addMode === "manual" ? "btn-primary" : "btn-outline"}`}
              onClick={() => { setAddMode("manual"); setUsernameError(""); }}
            >
              ✏️ הוספה ידנית
            </button>
            <button
              className={`btn btn-sm ${addMode === "username" ? "btn-primary" : "btn-outline"}`}
              onClick={() => { setAddMode("username"); setUsernameError(""); }}
            >
              👤 לפי שם משתמש
            </button>
          </div>

          {addMode === "manual" ? (
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input
                className="form-input"
                placeholder="שם החייל"
                value={newSoldierName}
                onChange={e => setNewSoldierName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addSoldierManual()}
              />
              <button className="btn btn-primary" onClick={addSoldierManual}>+ הוסף</button>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="form-input"
                  placeholder="שם משתמש (לדוגמה: david123)"
                  value={newSoldierUsername}
                  onChange={e => { setNewSoldierUsername(e.target.value); setUsernameError(""); }}
                  onKeyDown={e => e.key === "Enter" && addSoldierByUsername()}
                />
                <button className="btn btn-primary" onClick={addSoldierByUsername} disabled={usernameLoading}>
                  {usernameLoading ? "⏳" : "שלח הזמנה"}
                </button>
              </div>
              {usernameError && (
                <div style={{ color: "var(--danger, #e53e3e)", fontSize: "0.85rem", marginTop: 6 }}>
                  {usernameError}
                </div>
              )}
              <div style={{ color: "var(--gray-500)", fontSize: "0.82rem", marginTop: 6 }}>
                החייל ימצא לפי שם המשתמש שנרשם באפליקציה
              </div>
            </div>
          )}

          {soldiers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <p>לא הוספת חיילים עדיין</p>
            </div>
          ) : (
            <div>
              {soldiers.map((s, si) => (
                <div key={s.tempId} className="soldier-row">
                  <div className="soldier-avatar">{(s.name || "?")[0]}</div>
                  <div className="soldier-info">
                    <div className="soldier-name">
                    {s.name}
                    {s.type === "registered" && (
                      <span style={{ fontSize: "0.72rem", background: "var(--primary)", color: "#fff", borderRadius: 4, padding: "1px 6px", marginRight: 6 }}>
                        רשום
                      </span>
                    )}
                  </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      {DAY_LABELS.map((d, di) => (
                        <div
                          key={di}
                          className={`day-badge ${s.activeDays.includes(di) ? "selected" : ""}`}
                          style={{ width: 28, height: 28, fontSize: "0.7rem" }}
                          onClick={() => toggleSoldierDay(si, di)}
                        >{d}</div>
                      ))}
                    </div>
                  </div>
                  <button className="icon-btn danger" onClick={() => removeSoldier(si)}>🗑️</button>
                </div>
              ))}
              <div style={{ marginTop: 8, color: "var(--gray-500)", fontSize: "0.85rem" }}>
                סה"כ {soldiers.length} חיילים
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>← חזור</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              הבא ← שלב ג׳
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: History ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>שלב ג׳ — העלאת היסטוריה ראשונית</h3>
          <p style={{ color: "var(--gray-500)", fontSize: "0.9rem", marginBottom: 16 }}>
            הזן כמה פעמים כל חייל ביצע כל משימה בעבר. הנתונים ישמשו לחישוב שיוני הוגן.
          </p>

          <div className="form-group">
            <label className="form-label">תאריך ושעת תחילת הפעלת הקובץ</label>
            <input
              type="datetime-local"
              className="form-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ maxWidth: 260 }}
            />
          </div>

          {soldiers.length === 0 || tasks.length === 0 ? (
            <div className="alert alert-warning">
              חסרים חיילים או משימות. חזור לשלבים הקודמים.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>חייל / משימה</th>
                    {tasks.map((t, ti) => <th key={ti}>{t.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {soldiers.map((s, si) => (
                    <tr key={s.tempId}>
                      <td><strong>{s.name}</strong></td>
                      {tasks.map((t, ti) => (
                        <td key={ti}>
                          <input
                            type="number" min="0" max="999"
                            className="form-input"
                            style={{ width: 70, padding: "6px 8px" }}
                            value={history[`${s.tempId}_${ti}`] || 0}
                            onChange={e => setHistoryValue(s.tempId, ti, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <div className="alert alert-success" style={{ maxWidth: 480, margin: "0 auto 16px" }}>
              🎉 הכל מוכן — לחץ "שמור" לצאת לדרך!
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setStep(2)}>← חזור</button>
              <button className="btn btn-yellow btn-lg" onClick={handleSave} disabled={saving}>
                {saving ? "⏳ שומר..." : "💾 שמור והתחל!"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
