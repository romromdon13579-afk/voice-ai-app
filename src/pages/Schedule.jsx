import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsByCommander, getGroupsForSoldier,
  getSoldiersInGroup, getTasksForGroup,
  saveBulkSchedule, clearSchedulesForGroup,
  getSchedulesForGroup, getHistoryForGroup,
  updateScheduleSlot, addHistoryEntry
} from "../services/firestoreService.js";
import { computeSchedule } from "../services/schedulerAI.js";
import {
  geminiChat, buildChatSystemPrompt, buildRequirementsChatSystemPrompt, isGeminiConfigured
} from "../services/geminiService.js";
import { addDays, format, startOfDay } from "date-fns";

export default function Schedule() {
  const { currentUser, userProfile, isCommander } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const period = searchParams.get("period") || "week";
  const days = period === "day" ? 1 : period === "month" ? 30 : 7;

  // ── Core state ─────────────────────────────────────────────────────────
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [slots, setSlots] = useState([]);
  const [allSoldiers, setAllSoldiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workload, setWorkload] = useState({});
  const [soldierContext, setSoldierContext] = useState([]);
  const [taskContext, setTaskContext] = useState([]);

  // ── Generate options popup ─────────────────────────────────────────────
  const [showGenerateOptions, setShowGenerateOptions] = useState(false);
  const generateBtnRef = useRef(null);

  // ── Requirements chat (before generation) ─────────────────────────────
  const [showReqChat, setShowReqChat] = useState(false);
  const [reqMessages, setReqMessages] = useState([
    { role: "ai", text: "שלום! ספר לי מה הדרישות המיוחדות שלך לשיבוץ. לדוגמה: מי לא יכול עם מי, מי צריך שמירות ספציפיות, מגבלות זמן וכו׳. לאחר שנסכם את הדרישות, לחץ על ״חשב שיבוץ לפי הדרישות״." }
  ]);
  const [reqConversation, setReqConversation] = useState([]);
  const [reqInput, setReqInput] = useState("");
  const [reqLoading, setReqLoading] = useState(false);

  // ── AI Refinement chat (from AI bubble, modifies existing schedule) ────
  const [showRefChat, setShowRefChat] = useState(false);
  const [refMessages, setRefMessages] = useState([]);
  const [refConversation, setRefConversation] = useState([]);
  const [refInput, setRefInput] = useState("");
  const [refLoading, setRefLoading] = useState(false);

  // ── Regular Q&A chat ──────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([
    { role: "ai", text: isGeminiConfigured()
        ? "שלום! אני ה-AI של השיבוץ 🤖 שאל אותי כל דבר על הטבלה שלפניך."
        : "⚠️ הצ'אט אינו פעיל — הגדר VITE_GROQ_API_KEY בהגדרות Netlify להפעלה."
    }
  ]);
  const [chatConversation, setChatConversation] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // ── Slot edit ─────────────────────────────────────────────────────────
  const [editSlot, setEditSlot] = useState(null);
  const [editTaskCommander, setEditTaskCommander] = useState(null);
  const [editAssigned, setEditAssigned] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  const periodLabel = period === "day" ? "יממה" : period === "month" ? "חודש" : "שבוע";

  useEffect(() => { loadGroups(); }, [currentUser]);
  useEffect(() => { if (selectedGroup) loadSchedule(); }, [selectedGroup, days]);

  // Close generate options when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (showGenerateOptions && generateBtnRef.current && !generateBtnRef.current.contains(e.target)) {
        setShowGenerateOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGenerateOptions]);

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
      const [existing, soldiers] = await Promise.all([
        getSchedulesForGroup(selectedGroup.id, start, end),
        getSoldiersInGroup(selectedGroup.id)
      ]);
      setSlots(existing);
      setAllSoldiers(soldiers);
    } finally {
      setLoading(false);
    }
  }

  async function runGenerate(requirements = "") {
    if (!selectedGroup) return;
    setGenerating(true);
    try {
      const [soldiers, tasks, history] = await Promise.all([
        getSoldiersInGroup(selectedGroup.id),
        getTasksForGroup(selectedGroup.id),
        getHistoryForGroup(selectedGroup.id)
      ]);

      if (tasks.length === 0) { alert("אין משימות מוגדרות בקבוצה. הוסף משימות תחילה."); return; }
      if (soldiers.length === 0) { alert("אין חיילים בקבוצה. הוסף חיילים תחילה."); return; }

      const wl = {};
      soldiers.forEach(s => { wl[s.id] = 0; });
      history.forEach(h => {
        if (wl[h.soldierId] !== undefined) wl[h.soldierId] += (h.difficulty || 1) * (h.hours || 1);
      });
      setWorkload(wl);
      setSoldierContext(soldiers);
      setTaskContext(tasks);

      const { slots: generated, usedAI } = await computeSchedule({
        soldiers, tasks, history,
        startDate: startOfDay(new Date()),
        days,
        requirements
      });

      if (!usedAI) {
        setChatMessages(prev => [...prev, {
          role: "ai",
          text: "השיבוץ חושב עם האלגוריתם המקומי (Groq לא זמין). הוסף VITE_GROQ_API_KEY בהגדרות Netlify לשיבוץ חכם יותר."
        }]);
      }

      const firestoreSlots = generated.map(slot => ({
        taskId: slot.taskId,
        taskName: slot.taskName,
        date: slot.date,
        startTimeStr: slot.startTime,
        endTimeStr: slot.endTime,
        difficulty: slot.difficulty,
        dayOfWeek: slot.dayOfWeek,
        taskCommander: slot.taskCommander || null,
        assignedSoldiers: slot.assignedSoldiers,
        commanderName: userProfile?.displayName || "מפקד",
        groupId: selectedGroup.id,
        startTime: slot.date && slot.startTime ? new Date(slot.date + "T" + slot.startTime) : new Date()
      }));

      const periodStart = startOfDay(new Date());
      const periodEnd = addDays(periodStart, days);
      await clearSchedulesForGroup(selectedGroup.id, periodStart, periodEnd);
      await saveBulkSchedule(selectedGroup.id, firestoreSlots);

      // Reload to get Firestore IDs (needed for editing)
      await loadSchedule();
    } catch (err) {
      console.error("Generate error:", err);
      alert("שגיאה בחישוב השיבוץ. נסה שוב.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Requirements chat handlers ─────────────────────────────────────────

  function openReqChat() {
    setReqMessages([
      { role: "ai", text: "שלום! ספר לי מה הדרישות המיוחדות שלך לשיבוץ. לדוגמה: מי לא יכול עם מי, מי צריך שמירות ספציפיות, מגבלות זמן וכו׳. לאחר שנסכם את הדרישות, לחץ על ״חשב שיבוץ לפי הדרישות״." }
    ]);
    setReqConversation([]);
    setReqInput("");
    setShowReqChat(true);
  }

  async function handleReqSend(e) {
    e.preventDefault();
    const text = reqInput.trim();
    if (!text || reqLoading) return;
    setReqInput("");
    const newMsg = { role: "user", text };
    setReqMessages(prev => [...prev, newMsg]);
    setReqLoading(true);
    try {
      let soldiers = soldierContext;
      let tasks = taskContext;
      if (soldiers.length === 0 && selectedGroup) {
        [soldiers, tasks] = await Promise.all([
          getSoldiersInGroup(selectedGroup.id),
          getTasksForGroup(selectedGroup.id)
        ]);
        setSoldierContext(soldiers);
        setTaskContext(tasks);
      }
      const sysPrompt = buildRequirementsChatSystemPrompt({
        groupName: selectedGroup?.name, soldiers, tasks, slots: []
      });
      const newConv = [...reqConversation, newMsg];
      const reply = await geminiChat(newConv, sysPrompt);
      setReqConversation([...newConv, { role: "ai", text: reply }]);
      setReqMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      setReqMessages(prev => [...prev, { role: "ai", text: `שגיאה: ${err.message}` }]);
    } finally {
      setReqLoading(false);
    }
  }

  async function handleGenerateFromReqChat() {
    // Summarise conversation as requirements for the AI scheduler
    const reqSummary = reqConversation.map(m =>
      `${m.role === "user" ? "מפקד" : "AI"}: ${m.text}`
    ).join("\n");
    setShowReqChat(false);
    await runGenerate(reqSummary);
  }

  // ── Refinement chat handlers (AI bubble) ──────────────────────────────

  function openRefChat() {
    setRefMessages([
      { role: "ai", text: "איך אני יכול לסדר לך את הרשימה שתהיה מושלמת? תאר את השינויים שתרצה ואחשב שיבוץ חדש." }
    ]);
    setRefConversation([]);
    setRefInput("");
    setShowRefChat(true);
  }

  async function handleRefSend(e) {
    e.preventDefault();
    const text = refInput.trim();
    if (!text || refLoading) return;
    setRefInput("");
    const newMsg = { role: "user", text };
    setRefMessages(prev => [...prev, newMsg]);
    setRefLoading(true);
    try {
      let soldiers = soldierContext;
      let tasks = taskContext;
      if (soldiers.length === 0 && selectedGroup) {
        [soldiers, tasks] = await Promise.all([
          getSoldiersInGroup(selectedGroup.id),
          getTasksForGroup(selectedGroup.id)
        ]);
        setSoldierContext(soldiers);
        setTaskContext(tasks);
      }
      const sysPrompt = buildRequirementsChatSystemPrompt({
        groupName: selectedGroup?.name, soldiers, tasks, slots
      });
      const newConv = [...refConversation, newMsg];
      const reply = await geminiChat(newConv, sysPrompt);
      setRefConversation([...newConv, { role: "ai", text: reply }]);
      setRefMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      setRefMessages(prev => [...prev, { role: "ai", text: `שגיאה: ${err.message}` }]);
    } finally {
      setRefLoading(false);
    }
  }

  async function handleGenerateFromRefChat() {
    const reqSummary = refConversation.map(m =>
      `${m.role === "user" ? "מפקד" : "AI"}: ${m.text}`
    ).join("\n");
    setShowRefChat(false);
    await runGenerate(reqSummary);
  }

  // ── Regular Q&A chat ──────────────────────────────────────────────────

  async function handleAskAI(e) {
    e.preventDefault();
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: question }]);
    setChatLoading(true);
    try {
      if (!isGeminiConfigured()) throw new Error("MISSING_API_KEY");
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
      const systemPrompt = buildChatSystemPrompt({ groupName: selectedGroup?.name, soldiers, tasks, slots, workload });
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

  // ── Slot edit ─────────────────────────────────────────────────────────

  function openEditSlot(slot) {
    setEditSlot(slot);
    setEditTaskCommander(slot.taskCommander || null);
    setEditAssigned(slot.assignedSoldiers ? [...slot.assignedSoldiers] : []);
  }

  function toggleEditSoldier(soldier) {
    const exists = editAssigned.find(s => s.id === soldier.id);
    if (exists) {
      setEditAssigned(prev => prev.filter(s => s.id !== soldier.id));
    } else {
      setEditAssigned(prev => [...prev, { id: soldier.id, name: soldier.name || soldier.displayName }]);
    }
  }

  async function handleSaveSlot() {
    if (!editSlot?.id || !selectedGroup) return;
    setEditLoading(true);
    try {
      const updatedData = {
        taskCommander: editTaskCommander || null,
        assignedSoldiers: editAssigned
      };
      await updateScheduleSlot(selectedGroup.id, editSlot.id, updatedData);

      // Add history entries for newly assigned soldiers
      const prevIds = new Set((editSlot.assignedSoldiers || []).map(s => s.id));
      const prevCommId = editSlot.taskCommander?.id;
      const newlyAssigned = editAssigned.filter(s => !prevIds.has(s.id));
      if (editTaskCommander && editTaskCommander.id !== prevCommId) {
        newlyAssigned.push(editTaskCommander);
      }
      await Promise.all(newlyAssigned.map(s =>
        addHistoryEntry(selectedGroup.id, {
          soldierId: s.id,
          soldierName: s.name,
          taskName: editSlot.taskName,
          difficulty: editSlot.difficulty || 1,
          count: 1,
          hours: 4,
          isHistorical: false
        })
      ));

      // Update local state
      setSlots(prev => prev.map(sl =>
        sl.id === editSlot.id ? { ...sl, ...updatedData } : sl
      ));
      setEditSlot(null);
    } catch (err) {
      alert("שגיאה בשמירת השינויים: " + err.message);
    } finally {
      setEditLoading(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>📅</span>
          <h2>שיבוץ קבוצתי ל{periodLabel} הקרוב{period !== "day" ? "ה" : ""}</h2>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="form-select"
            style={{ width: "auto", minWidth: 200 }}
            value={selectedGroup?.id || ""}
            onChange={e => setSelectedGroup(groups.find(g => g.id === e.target.value))}
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

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

          {/* Split generate button */}
          {isCommander && (
            <div ref={generateBtnRef} style={{ position: "relative" }}>
              <button
                className="btn btn-yellow"
                onClick={() => !generating && setShowGenerateOptions(v => !v)}
                disabled={generating || !selectedGroup}
              >
                {generating ? "⏳ מחשב..." : "🤖 חשב שיבוץ AI ▾"}
              </button>

              {showGenerateOptions && !generating && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                  background: "white", borderRadius: 14, boxShadow: "0 6px 32px rgba(0,0,0,0.18)",
                  padding: 12, minWidth: 270, display: "flex", flexDirection: "column", gap: 10
                }}>
                  <div
                    className="generate-option-card"
                    style={{
                      border: "2px solid var(--primary)", borderRadius: 10, padding: "14px 16px",
                      cursor: "pointer", background: "var(--primary-light, #f0f4ff)"
                    }}
                    onClick={() => { setShowGenerateOptions(false); runGenerate(); }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>🤖 חשב אוטומטי</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--gray-600)" }}>
                      תחשב בצורה אוטומטית לפי היסטוריה
                    </div>
                  </div>

                  <div
                    className="generate-option-card"
                    style={{
                      border: "2px solid var(--warning, #f59e0b)", borderRadius: 10, padding: "14px 16px",
                      cursor: "pointer", background: "#fffbeb"
                    }}
                    onClick={() => { setShowGenerateOptions(false); openReqChat(); }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>💬 חשב + בקשה מכוונת</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--gray-600)" }}>
                      חשב לפי היסטוריה + בקשה מכוונת
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Schedule table */}
      <div className="card">
        {loading || generating ? (
          <div className="loading-overlay">
            <div className="spinner" />
            <p style={{ marginTop: 16 }}>{generating ? "ה-AI מחשב שיבוץ הוגן..." : "טוען..."}</p>
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
            {/* AI Refinement Bubble */}
            {isCommander && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button
                  onClick={openRefChat}
                  title="לשינויים תלחץ כאן"
                  style={{
                    width: 60, height: 60, borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none", color: "white", cursor: "pointer",
                    fontSize: "0.75rem", fontWeight: 700, lineHeight: 1.2,
                    boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    transition: "transform 0.15s",
                    flexShrink: 0
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  <span style={{ fontSize: "1.1rem" }}>🤖</span>
                  <span>AI</span>
                </button>
                <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", alignSelf: "center", marginRight: 8 }}>
                  לשינויים תלחץ כאן
                </div>
              </div>
            )}

            {Object.keys(slotsByDate).sort().map(dateKey => (
              <div key={dateKey} style={{ marginBottom: 24 }}>
                <h3 style={{
                  color: "var(--primary)", marginBottom: 12,
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
                        <th>⭐ מפקד משימה</th>
                        <th>🪖 חיילים</th>
                        <th>קושי</th>
                        {isCommander && <th>עריכה</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {slotsByDate[dateKey].map((slot, i) => (
                        <tr key={i}>
                          <td><strong>{slot.taskName}</strong></td>
                          <td>{slot.startTimeStr}</td>
                          <td>{slot.endTimeStr}</td>
                          <td>
                            {slot.taskCommander
                              ? <span style={{ color: "var(--warning, #b45309)", fontWeight: 600 }}>⭐ {slot.taskCommander.name}</span>
                              : <span style={{ color: "var(--gray-400)" }}>—</span>}
                          </td>
                          <td>
                            {slot.assignedSoldiers?.map(s => s.name).join(", ") || "—"}
                          </td>
                          <td>{diffBadge(slot.difficulty)}</td>
                          {isCommander && (
                            <td>
                              <button
                                className="icon-btn"
                                title="ערוך שיבוץ ידנית"
                                onClick={() => openEditSlot(slot)}
                                disabled={!slot.id}
                              >✏️</button>
                            </td>
                          )}
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

      {/* Q&A Chat */}
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
                  <strong style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", opacity: 0.7 }}>🤖 AI</strong>
                )}
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
              </div>
            ))}
            {chatLoading && (
              <div className="chat-bubble ai">
                <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem" }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} />
                  AI חושב...
                </span>
              </div>
            )}
          </div>
          <form className="chat-input-row" onSubmit={handleAskAI}>
            <input
              className="form-input"
              placeholder={isGeminiConfigured()
                ? 'למשל: "למה אני שובצתי?" או "מי הכי פנוי מחר?"'
                : "הגדר VITE_GROQ_API_KEY להפעלת הצ'אט"}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              style={{ flex: 1 }}
              disabled={chatLoading || !isGeminiConfigured()}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={chatLoading || !chatInput.trim() || !isGeminiConfigured()}
            >שאל</button>
          </form>
        </div>
      </div>

      {/* ── Requirements Chat Modal ─────────────────────────────────────── */}
      {showReqChat && (
        <div className="modal-backdrop" onClick={() => setShowReqChat(false)}>
          <div className="modal" style={{ maxWidth: 520, width: "95%" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💬 הגדרת דרישות לשיבוץ</h3>
              <button className="icon-btn" onClick={() => setShowReqChat(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <div className="chat-container" style={{ height: 320, borderRadius: 0 }}>
                <div className="chat-messages">
                  {reqMessages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                      {msg.role === "ai" && (
                        <strong style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", opacity: 0.7 }}>🤖 AI</strong>
                      )}
                      <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
                    </div>
                  ))}
                  {reqLoading && (
                    <div className="chat-bubble ai">
                      <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem" }}>
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} />
                        AI חושב...
                      </span>
                    </div>
                  )}
                </div>
                <form className="chat-input-row" onSubmit={handleReqSend}>
                  <input
                    className="form-input"
                    placeholder="תאר את הדרישות שלך..."
                    value={reqInput}
                    onChange={e => setReqInput(e.target.value)}
                    style={{ flex: 1 }}
                    disabled={reqLoading}
                    autoFocus
                  />
                  <button className="btn btn-primary" type="submit" disabled={reqLoading || !reqInput.trim()}>שלח</button>
                </form>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowReqChat(false)}>ביטול</button>
              <button
                className="btn btn-yellow"
                onClick={handleGenerateFromReqChat}
                disabled={reqConversation.length === 0}
              >
                ⚡ חשב שיבוץ לפי הדרישות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refinement Chat Modal (AI Bubble) ──────────────────────────── */}
      {showRefChat && (
        <div className="modal-backdrop" onClick={() => setShowRefChat(false)}>
          <div className="modal" style={{ maxWidth: 520, width: "95%" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🤖 שיפור השיבוץ עם AI</h3>
              <button className="icon-btn" onClick={() => setShowRefChat(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <div className="chat-container" style={{ height: 320, borderRadius: 0 }}>
                <div className="chat-messages">
                  {refMessages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                      {msg.role === "ai" && (
                        <strong style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", opacity: 0.7 }}>🤖 AI</strong>
                      )}
                      <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
                    </div>
                  ))}
                  {refLoading && (
                    <div className="chat-bubble ai">
                      <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem" }}>
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} />
                        AI חושב...
                      </span>
                    </div>
                  )}
                </div>
                <form className="chat-input-row" onSubmit={handleRefSend}>
                  <input
                    className="form-input"
                    placeholder="איך אני יכול לסדר לך את הרשימה שתהיה מושלמת?"
                    value={refInput}
                    onChange={e => setRefInput(e.target.value)}
                    style={{ flex: 1 }}
                    disabled={refLoading}
                    autoFocus
                  />
                  <button className="btn btn-primary" type="submit" disabled={refLoading || !refInput.trim()}>שלח</button>
                </form>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRefChat(false)}>ביטול</button>
              <button
                className="btn btn-yellow"
                onClick={handleGenerateFromRefChat}
                disabled={refConversation.length === 0}
              >
                ⚡ חשב שיבוץ חדש לפי הדרישות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slot Edit Modal ─────────────────────────────────────────────── */}
      {editSlot && (
        <div className="modal-backdrop" onClick={() => setEditSlot(null)}>
          <div className="modal" style={{ maxWidth: 480, width: "95%" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ עריכת שיבוץ ידנית</h3>
              <button className="icon-btn" onClick={() => setEditSlot(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: "var(--gray-100)", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                <strong>{editSlot.taskName}</strong>
                <span style={{ marginRight: 8, color: "var(--gray-600)", fontSize: "0.9rem" }}>
                  {editSlot.startTimeStr}–{editSlot.endTimeStr}
                </span>
              </div>

              {/* Task Commander selector */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">⭐ מפקד משימה</label>
                <select
                  className="form-select"
                  value={editTaskCommander?.id || ""}
                  onChange={e => {
                    const s = allSoldiers.find(sol => sol.id === e.target.value);
                    setEditTaskCommander(s ? { id: s.id, name: s.name || s.displayName } : null);
                  }}
                >
                  <option value="">— ללא מפקד משימה —</option>
                  {allSoldiers.filter(s => s.active !== false).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.displayName}{s.role === "commander" ? " ⭐" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Soldiers checkboxes */}
              <div className="form-group">
                <label className="form-label">🪖 חיילים משובצים</label>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--gray-200)", borderRadius: 8, padding: 8 }}>
                  {allSoldiers.filter(s => s.active !== false).map(s => {
                    const isCommander = editTaskCommander?.id === s.id;
                    const isChecked = editAssigned.some(a => a.id === s.id);
                    return (
                      <label
                        key={s.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                          opacity: isCommander ? 0.4 : 1,
                          background: isChecked ? "var(--primary-light, #eff6ff)" : "transparent"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isCommander}
                          onChange={() => toggleEditSoldier(s)}
                        />
                        <span>{s.name || s.displayName}</span>
                        {s.role === "commander" && <span style={{ fontSize: "0.75rem", color: "var(--warning, #b45309)" }}>⭐</span>}
                        {isCommander && <span style={{ fontSize: "0.75rem", color: "var(--gray-400)" }}>(מפקד)</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditSlot(null)}>ביטול</button>
              <button
                className="btn btn-primary"
                onClick={handleSaveSlot}
                disabled={editLoading}
              >
                {editLoading ? "שומר..." : "💾 שמור שינויים"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
