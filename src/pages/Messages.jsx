import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsByCommander, getGroupsForSoldier, getMessagesForUser
} from "../services/firestoreService.js";

export default function Messages() {
  const { currentUser, isCommander } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMsg, setSelectedMsg] = useState(null);

  useEffect(() => { loadMessages(); }, [currentUser]);

  async function loadMessages() {
    setLoading(true);
    try {
      const groups = isCommander
        ? await getGroupsByCommander(currentUser.uid)
        : await getGroupsForSoldier(currentUser.uid);

      const allMsgs = [];
      for (const g of groups) {
        const msgs = await getMessagesForUser(g.id, currentUser.uid);
        allMsgs.push(...msgs.map(m => ({ ...m, groupName: g.name })));
      }
      allMsgs.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.sentAt || 0);
        const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.sentAt || 0);
        return tb - ta;
      });
      setMessages(allMsgs);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(msg) {
    const d = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.sentAt || 0);
    return d.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>🔔</span>
          <h2>הודעות</h2>
          <span className="badge badge-olive" style={{ marginRight: "auto" }}>{messages.length}</span>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>אין הודעות</h3>
            <p>תיבת ההודעות ריקה</p>
          </div>
        ) : (
          <div>
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: "var(--radius-sm)",
                  background: selectedMsg?.id === msg.id ? "#eef2e8" : "var(--gray-100)",
                  marginBottom: 8,
                  cursor: "pointer",
                  borderRight: "3px solid var(--olive)",
                  transition: "background 0.2s"
                }}
                onClick={() => setSelectedMsg(selectedMsg?.id === msg.id ? null : msg)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong>{msg.title || "ללא נושא"}</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>{formatTime(msg)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--gray-500)" }}>
                    מ: {msg.senderName} • {msg.subject}
                  </span>
                  <span className="badge badge-gray" style={{ fontSize: "0.72rem" }}>{msg.groupName}</span>
                </div>

                {selectedMsg?.id === msg.id && (
                  <div style={{
                    marginTop: 12, padding: 12,
                    background: "var(--white)", borderRadius: "var(--radius-sm)",
                    fontSize: "0.9rem", lineHeight: 1.7
                  }}>
                    {msg.body}
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={e => { e.stopPropagation(); navigate(`/send-message?to=${msg.senderUid}`); }}
                      >
                        ↩️ הגב
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <button className="btn btn-primary" onClick={() => navigate("/send-message")}>
          ✉️ הודעה חדשה
        </button>
      </div>
    </div>
  );
}
