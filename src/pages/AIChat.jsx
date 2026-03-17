import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsByCommander, getGroupsForSoldier,
  getSoldiersInGroup, getTasksForGroup,
  getSchedulesForGroup, getHistoryForGroup
} from "../services/firestoreService.js";
import {
  geminiChat, buildChatSystemPrompt, isGeminiConfigured
} from "../services/geminiService.js";
import { subDays, startOfDay } from "date-fns";

const SUGGESTED = [
  "למה אני שובצתי לש\"ג הלילה שוב?",
  "מי הכי פנוי לשיבוץ מחר?",
  "מה ההסבר לשיבוץ של יום חמישי?",
  "כמה שמירות עשיתי החודש?",
  "מי עשה הכי הרבה שמירות?",
  "האם השיבוץ הוגן?",
];

// Banner shown when API key is missing
function MissingKeyBanner() {
  return (
    <div className="alert alert-warning" style={{ lineHeight: 1.7 }}>
      <strong>⚠️ מפתח Groq API חסר</strong><br />
      כדי להפעיל את הצ'אט יש להוסיף את מפתח ה-API (חינמי!) בהגדרות Netlify:<br />
      <code style={{ background: "rgba(0,0,0,0.08)", padding: "2px 6px", borderRadius: 4 }}>
        VITE_GROQ_API_KEY=your-key-here
      </code><br />
      <span style={{ fontSize: "0.82rem", opacity: 0.8 }}>
        קבל מפתח חינמי ב: <a href="https://console.groq.com" target="_blank" rel="noreferrer">console.groq.com</a>
      </span>
    </div>
  );
}

export default function AIChat() {
  const { currentUser, userProfile, isCommander } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [soldiers, setSoldiers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [slots, setSlots] = useState([]);
  const [workload, setWorkload] = useState({});
  const [contextReady, setContextReady] = useState(false);

  // conversationHistory holds messages sent to Gemini (excludes system prompt)
  const [conversationHistory, setConversationHistory] = useState([]);
  // displayMessages is what the user sees
  const [displayMessages, setDisplayMessages] = useState([
    {
      role: "ai",
      text: isGeminiConfigured()
        ? "שלום! אני ה-AI של שבצ\"ק שמירות 🤖\nאני מחובר ל-Claude ומוכן לענות על כל שאלה בנוגע לשיבוצים, עומסי חיילים ולמה כל חייל שובץ לכל משימה.\nשאל אותי כל דבר!"
        : "צ'אט ה-AI אינו זמין — מפתח API חסר.",
      time: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const geminiReady = isGeminiConfigured();

  useEffect(() => { loadGroups(); }, [currentUser]);
  useEffect(() => { if (selectedGroup) loadContext(); }, [selectedGroup]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [displayMessages]);

  async function loadGroups() {
    const g = isCommander
      ? await getGroupsByCommander(currentUser.uid)
      : await getGroupsForSoldier(currentUser.uid);
    setGroups(g);
    if (g.length > 0) setSelectedGroup(g[0]);
    else setContextReady(true); // no groups — allow chat without context
  }

  async function loadContext() {
    if (!selectedGroup) return;
    setContextReady(false);
    const [soldierList, taskList, history] = await Promise.all([
      getSoldiersInGroup(selectedGroup.id),
      getTasksForGroup(selectedGroup.id),
      getHistoryForGroup(selectedGroup.id)
    ]);
    setSoldiers(soldierList);
    setTasks(taskList);

    const end = new Date();
    const start = subDays(end, 30);
    const scheduleData = await getSchedulesForGroup(selectedGroup.id, startOfDay(start), end);
    setSlots(scheduleData);

    // Build workload map
    const wl = {};
    soldierList.forEach(s => { wl[s.id] = 0; });
    history.forEach(h => {
      if (wl[h.soldierId] !== undefined)
        wl[h.soldierId] += (h.difficulty || 1) * (h.hours || 1);
    });
    scheduleData.forEach(s => {
      s.assignedSoldiers?.forEach(a => {
        if (wl[a.id] !== undefined) wl[a.id] += (s.difficulty || 1) * 4;
      });
    });
    setWorkload(wl);
    setContextReady(true);
    // Reset conversation when group changes
    setConversationHistory([]);
  }

  async function handleSend(question) {
    const q = (question || input).trim();
    if (!q || loading || !geminiReady) return;
    setInput("");

    const userMsg = { role: "user", text: q, time: new Date() };
    setDisplayMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const systemPrompt = buildChatSystemPrompt({
        groupName: selectedGroup?.name,
        soldiers,
        tasks,
        slots,
        workload
      });

      // Build history including the new user message
      const historyWithNew = [...conversationHistory, { role: "user", text: q }];

      const reply = await geminiChat(historyWithNew, systemPrompt);

      // Persist history for multi-turn context
      setConversationHistory([
        ...historyWithNew,
        { role: "ai", text: reply }
      ]);

      setDisplayMessages(prev => [
        ...prev,
        { role: "ai", text: reply, time: new Date() }
      ]);
    } catch (err) {
      const errText = err.message === "MISSING_API_KEY"
        ? "⚠️ מפתח API חסר. הגדר VITE_GROQ_API_KEY בהגדרות Netlify"
        : `שגיאה: ${err.message}`;
      setDisplayMessages(prev => [
        ...prev,
        { role: "ai", text: errText, time: new Date(), isError: true }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(t) {
    return new Date(t).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>🤖</span>
          <h2>צ'אט שאלות AI</h2>
          <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {geminiReady
              ? <span className="badge badge-success">✓ Claude מחובר</span>
              : <span className="badge badge-danger">✗ API לא מוגדר</span>
            }
            <select
              className="form-select"
              style={{ width: "auto" }}
              value={selectedGroup?.id || ""}
              onChange={e => {
                setSelectedGroup(groups.find(g => g.id === e.target.value));
              }}
            >
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        {!geminiReady && <MissingKeyBanner />}

        {geminiReady && (
          <div className="alert alert-info" style={{ fontSize: "0.85rem" }}>
            💡 ה-AI קורא את נתוני הקבוצה בזמן אמת ומסביר החלטות שיבוץ בשפה טבעית.
            {!contextReady && " (טוען נתונים...)"}
          </div>
        )}

        {/* Suggested questions */}
        {geminiReady && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.82rem", color: "var(--gray-500)", marginBottom: 6 }}>שאלות מוצעות:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTED.map((q, i) => (
                <button
                  key={i}
                  className="btn btn-ghost btn-sm"
                  style={{ border: "1px solid var(--gray-300)", fontSize: "0.82rem" }}
                  onClick={() => handleSend(q)}
                  disabled={loading || !contextReady}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="chat-container">
          <div className="chat-messages">
            {displayMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-start" : "flex-end"
                }}
              >
                <div style={{ fontSize: "0.72rem", color: "var(--gray-500)", marginBottom: 2 }}>
                  {msg.role === "user" ? `👤 ${userProfile?.displayName || "אתה"}` : "🤖 Claude AI"} • {formatTime(msg.time)}
                </div>
                <div
                  className={`chat-bubble ${msg.role}`}
                  style={{
                    whiteSpace: "pre-wrap",
                    ...(msg.isError ? { background: "#ffebee", color: "var(--danger)" } : {})
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div className="chat-bubble ai">
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
                    Claude חושב...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="chat-input-row"
            onSubmit={e => { e.preventDefault(); handleSend(); }}
          >
            <input
              className="form-input"
              placeholder={geminiReady ? 'שאל שאלה... למשל "כמה שמירות עשיתי החודש?"' : "הגדר מפתח API כדי להפעיל את הצ'אט"}
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{ flex: 1 }}
              disabled={loading || !geminiReady || !contextReady}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !input.trim() || !geminiReady || !contextReady}
            >
              {loading ? "⏳" : "שאל 🤖"}
            </button>
          </form>
        </div>

        {/* Workload summary */}
        {soldiers.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 12, color: "var(--olive)" }}>עומסי חיילים נוכחיים</h3>
            {[...soldiers]
              .sort((a, b) => (workload[b.id] || 0) - (workload[a.id] || 0))
              .slice(0, 8)
              .map(s => {
                const wl = workload[s.id] || 0;
                const max = Math.max(...soldiers.map(x => workload[x.id] || 0), 1);
                const pct = Math.round((wl / max) * 100);
                return (
                  <div key={s.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.88rem" }}>
                      <span style={{ fontWeight: 600 }}>{s.name || s.displayName}</span>
                      <span style={{ color: "var(--gray-500)" }}>{Math.round(wl)} נקודות עומס</span>
                    </div>
                    <div style={{ height: 8, background: "var(--gray-200)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`,
                        background: pct > 80 ? "var(--danger)" : pct > 50 ? "var(--yellow-dark)" : "var(--olive)",
                        borderRadius: 4, transition: "width 0.5s"
                      }} />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
