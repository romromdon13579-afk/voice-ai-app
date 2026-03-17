import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsByCommander, getGroupsForSoldier,
  getSoldiersInGroup, getTasksForGroup,
  getSchedulesForGroup, getHistoryForGroup
} from "../services/firestoreService.js";
import { answerScheduleQuestion } from "../services/schedulerAI.js";
import { subDays, startOfDay } from "date-fns";

const SUGGESTED = [
  "למה אני שובצתי לש\"ג הלילה שוב?",
  "מי הכי פנוי לשיבוץ מחר?",
  "מה ההסבר לשיבוץ של יום חמישי?",
  "כמה שמירות עשיתי החודש?",
  "מי עשה הכי הרבה שמירות?",
];

export default function AIChat() {
  const { currentUser, isCommander } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [soldiers, setSoldiers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [workload, setWorkload] = useState({});
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "שלום! אני ה-AI של שבצ\"ק שמירות 🤖\nאני יכול לענות על שאלות בנוגע לשיבוצים, חלוקת עומסים, ומדוע כל חייל שובץ לכל משימה.\nנסה לשאול אותי כל דבר!",
      time: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadGroups(); }, [currentUser]);
  useEffect(() => { if (selectedGroup) loadContext(); }, [selectedGroup]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadGroups() {
    const g = isCommander
      ? await getGroupsByCommander(currentUser.uid)
      : await getGroupsForSoldier(currentUser.uid);
    setGroups(g);
    if (g.length > 0) setSelectedGroup(g[0]);
  }

  async function loadContext() {
    if (!selectedGroup) return;
    const [soldierList, taskList, history] = await Promise.all([
      getSoldiersInGroup(selectedGroup.id),
      getTasksForGroup(selectedGroup.id),
      getHistoryForGroup(selectedGroup.id)
    ]);
    setSoldiers(soldierList);

    const end = new Date();
    const start = subDays(end, 30);
    const scheduleData = await getSchedulesForGroup(selectedGroup.id, startOfDay(start), end);
    setSlots(scheduleData);

    // Build workload
    const wl = {};
    soldierList.forEach(s => { wl[s.id] = 0; });
    history.forEach(h => {
      if (wl[h.soldierId] !== undefined) {
        wl[h.soldierId] += (h.difficulty || 1) * (h.hours || 1);
      }
    });
    scheduleData.forEach(s => {
      s.assignedSoldiers?.forEach(a => {
        if (wl[a.id] !== undefined) wl[a.id] += (s.difficulty || 1) * 4;
      });
    });
    setWorkload(wl);
  }

  async function handleSend(question) {
    const q = question || input.trim();
    if (!q) return;
    setInput("");

    const userMsg = { role: "user", text: q, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Small delay for UX
    await new Promise(r => setTimeout(r, 600));

    const answer = answerScheduleQuestion(q, slots, soldiers, workload);
    setMessages(prev => [...prev, { role: "ai", text: answer, time: new Date() }]);
    setLoading(false);
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
          <select
            className="form-select"
            style={{ width: "auto", marginRight: "auto" }}
            value={selectedGroup?.id || ""}
            onChange={e => setSelectedGroup(groups.find(g => g.id === e.target.value))}
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="alert alert-info" style={{ fontSize: "0.85rem" }}>
          💡 ה-AI מסביר החלטות שיבוץ, עונה על שאלות, ומאפשר שקיפות מלאה בתהליך.
        </div>

        {/* Suggested questions */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: "0.82rem", color: "var(--gray-500)", marginBottom: 6 }}>שאלות מוצעות:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTED.map((q, i) => (
              <button
                key={i}
                className="btn btn-ghost btn-sm"
                style={{ border: "1px solid var(--gray-300)", fontSize: "0.82rem" }}
                onClick={() => handleSend(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-start" : "flex-end" }}>
                <div style={{ fontSize: "0.72rem", color: "var(--gray-500)", marginBottom: 2 }}>
                  {msg.role === "user" ? "👤 אתה" : "🤖 AI"} • {formatTime(msg.time)}
                </div>
                <div className={`chat-bubble ${msg.role}`} style={{ whiteSpace: "pre-wrap" }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div className="chat-bubble ai" style={{ padding: "12px 16px" }}>
                  <span style={{ letterSpacing: 2 }}>⏳ חושב...</span>
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
              placeholder='שאל שאלה... למשל "כמה שמירות עשיתי החודש?"'
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
              שאל 🤖
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
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ color: "var(--gray-500)" }}>{wl.toFixed(0)} נקודות עומס</span>
                    </div>
                    <div style={{ height: 8, background: "var(--gray-200)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: pct > 80 ? "var(--danger)" : pct > 50 ? "var(--yellow-dark)" : "var(--olive)",
                        borderRadius: 4,
                        transition: "width 0.5s"
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
