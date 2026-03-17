import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsByCommander, getGroupsForSoldier,
  getSoldiersInGroup, getTasksForGroup,
  saveBulkSchedule, getSchedulesForGroup,
  getHistoryForGroup
} from "../services/firestoreService.js";
import { computeSchedule } from "../services/schedulerAI.js";
import {
  geminiChat, buildChatSystemPrompt, isGeminiConfigured
} from "../services/geminiService.js";
import { addDays, format, startOfDay } from "date-fns";

export default function Schedule() {
  const { currentUser, userProfile, isCommander } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const period = searchParams.get("period") || "week";
  const days = period === "day" ? 1 : period === "month" ? 30 : 7;

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: "ai", text: isGeminiConfigured()
        ? "שלום! אני ה-AI של השיבוץ 🤖 שאל אותי כל דבר על הטבלה שלפניך."
        : "⚠️ הצ'אט אינו פעיל — הגדר VITE_GROQ_API_KEY בהגדרות Netlify להפעלה."
    }
  ]);
  const [chatConversation, setChatConversation] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [workload, setWorkload] = useState({});
  const [soldierContext, setSoldierContext] = useState([]);
  const [taskContext, setTaskContext] = useState([]);

  const periodLabel = period === "day" ? "יממה" : period === "month" ? "חודש" : "שבוע";

  useEffect(() => { loadGroups(); }, [currentUser]);
  useEffect(() => { if (selectedGroup) loadSchedule(); }, [selectedGroup]);

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

  async function loadSchedule() {
    if (!selectedGroup) return;
    setLoading(true);
    try {
      const start = startOfDay(new Date());
      const end = addDays(start, days);
      const existing = await getSchedulesForGroup(selectedGroup.id, start, end);
      setSlots(existing);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedGroup) return;
    setGenerating(true);
    try {
      const [soldiers, tasks, history] = await Promise.all([
        getSoldiersInGroup(selectedGroup.id),
        getTasksForGroup(selectedGroup.id),
        getHistoryForGroup(selectedGroup.id)
      ]);

      if (tasks.length === 0) {
        alert("אין משימות מוגדרות בקבוצה. הוסף משימות תחילה.");
        return;
      }

      // Build workload map
      const wl = {};
      soldiers.forEach(s => { wl[s.id] = 0; });
      history.forEach(h => {
        if (wl[h.soldierId] !== undefined) {
          wl[h.soldierId] += (h.difficulty || 1) * (h.hours || 1);
        }
      });
      setWorkload(wl);

      setSoldierContext(soldiers);
      setTaskContext(tasks);

      const { slots: generated, usedAI } = await computeSchedule({
        soldiers, tasks, history,
        startDate: startOfDay(new Date()),
        days
      });

      if (!usedAI) {
        setChatMessages(prev => [...prev, {
          role: "ai",
          text: "השיבוץ חושב עם האלגוריתם המקומי (Groq לא זמין). הוסף VITE_GROQ_API_KEY בהגדרות Netlify לשיבוץ חכם יותר."
        }]);
      }

      // Convert to Firestore format
      const firestoreSlots = generated.map(slot => ({
        taskId: slot.taskId,
        taskName: slot.taskName,
        date: slot.date,
        startTimeStr: slot.startTime,
        endTimeStr: slot.endTime,
        difficulty: slot.difficulty,
        dayOfWeek: slot.dayOfWeek,
        assignedSoldiers: slot.assignedSoldiers,
        commanderName: userProfile?.displayName || "מפקד",
        groupId: selectedGroup.id,
        startTime: slot.date && slot.startTime ? new Date(slot.date + "T" + slot.startTime) : new Date()
      }));

      await saveBulkSchedule(selectedGroup.id, firestoreSlots);
      setSlots(firestoreSlots);
    } catch (err) {
      console.error("Generate error:", err);
      alert("שגיאה בחישוב השיבוץ. נסה שוב.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAskAI(e) {
    e.preventDefault();
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: question }]);
    setChatLoading(true);

    try {
      if (!isGeminiConfigured()) throw new Error("MISSING_API_KEY");

      // Load context on demand if not yet populated (before first generate)
      let soldiers = soldierContext;
      let tasks = taskContext;
      if (selectedGroup && soldiers.length === 0) {
        [soldiers, tasks] = await Promise.all([
          getSoldiersInGroup(selectedGroup.id),
          getTasksForGroup(selectedGroup.id)
        ]);
        setSoldierContext(soldiers);
        setTaskContext(tasks);
      }

      const systemPrompt = buildChatSystemPrompt({
        groupName: selectedGroup?.name,
        soldiers,
        tasks,
        slots,
        workload
      });

      const historyWithNew = [...chatConversation, { role: "user", text: question }];
      const reply = await geminiChat(historyWithNew, systemPrompt);
      setChatConversation([...historyWithNew, { role: "ai", text: reply }]);
      setChatMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      const errText = err.message === "MISSING_API_KEY"
        ? "⚠️ מפתח API חסר — הגדר VITE_GROQ_API_KEY בהגדרות Netlify"
        : `שגיאה: ${err.message}`;
      setChatMessages(prev => [...prev, { role: "ai", text: errText }]);
    } finally {
      setChatLoading(false);
    }
  }

  // Group slots by date
  const slotsByDate = {};
  slots.forEach(slot => {
    const dateKey = slot.date || "ללא תאריך";
    if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
    slotsByDate[dateKey].push(slot);
  });

  function formatDateHe(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  }

  const diffBadge = d => (
    <span className={`difficulty-badge diff-${d}`}>{"★".repeat(d)}</span>
  );

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>📅</span>
          <h2>שיבוץ קבוצתי ל{periodLabel} הקרוב{period !== "day" ? "ה" : ""}</h2>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Group selector */}
          <select
            className="form-select"
            style={{ width: "auto", minWidth: 200 }}
            value={selectedGroup?.id || ""}
            onChange={e => setSelectedGroup(groups.find(g => g.id === e.target.value))}
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          {/* Period selector */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { val: "day", label: "יממה" },
              { val: "week", label: "שבוע" },
              { val: "month", label: "חודש" }
            ].map(p => (
              <button
                key={p.val}
                className={`btn ${period === p.val ? "btn-primary" : "btn-outline"} btn-sm`}
                onClick={() => navigate(`/schedule?period=${p.val}`)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {isCommander && (
            <button
              className="btn btn-yellow"
              onClick={handleGenerate}
              disabled={generating || !selectedGroup}
            >
              {generating ? "⏳ מחשב..." : "🤖 חשב שיבוץ AI"}
            </button>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="card">
        {loading || generating ? (
          <div className="loading-overlay">
            <div className="spinner" />
            <p style={{ marginTop: 16 }}>
              {generating ? "ה-AI מחשב שיבוץ הוגן..." : "טוען..."}
            </p>
          </div>
        ) : slots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>אין שיבוץ מחושב עדיין</h3>
            {isCommander
              ? <p>לחץ על "חשב שיבוץ AI" כדי לייצר שיבוץ אוטומטי הוגן</p>
              : <p>המפקד טרם חישב שיבוץ לתקופה זו</p>
            }
          </div>
        ) : (
          <div>
            {Object.keys(slotsByDate).sort().map(dateKey => (
              <div key={dateKey} style={{ marginBottom: 24 }}>
                <h3 style={{
                  color: "var(--olive)", marginBottom: 12,
                  paddingBottom: 8, borderBottom: "2px solid var(--gray-200)"
                }}>
                  📅 {formatDateHe(dateKey)}
                </h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>שם הפעילות</th>
                        <th>שעת התחלה</th>
                        <th>שעת סיום</th>
                        <th>מפקד הפעילות</th>
                        <th>שותפים לפעילות</th>
                        <th>קושי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slotsByDate[dateKey].map((slot, i) => (
                        <tr key={i}>
                          <td><strong>{slot.taskName}</strong></td>
                          <td>{slot.startTimeStr}</td>
                          <td>{slot.endTimeStr}</td>
                          <td>{slot.commanderName || "—"}</td>
                          <td>
                            {slot.assignedSoldiers?.map(s => s.name).join(", ") || "—"}
                          </td>
                          <td>{diffBadge(slot.difficulty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Chat */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>🤖</span>
          <h2>שאל את ה-AI על השיבוץ</h2>
        </div>

        <div className="chat-container">
          <div className="chat-messages">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                {msg.role === "ai" && (
                  <strong style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", opacity: 0.7 }}>
                    🤖 Claude AI
                  </strong>
                )}
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
              </div>
            ))}
            {chatLoading && (
              <div className="chat-bubble ai">
                <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem" }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} />
                  Claude חושב...
                </span>
              </div>
            )}
          </div>
          <form className="chat-input-row" onSubmit={handleAskAI}>
            <input
              className="form-input"
              placeholder={isGeminiConfigured()
                ? 'למשל: "למה אני שובצתי?" או "מי הכי פנוי מחר?"'
                : "הגדר VITE_GEMINI_API_KEY להפעלת הצ'אט"}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              style={{ flex: 1 }}
              disabled={chatLoading || !isGeminiConfigured()}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={chatLoading || !chatInput.trim() || !isGeminiConfigured()}
            >
              שאל
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
