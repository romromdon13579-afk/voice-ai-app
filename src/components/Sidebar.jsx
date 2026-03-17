import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const soldierNav = [
  { path: "/", icon: "🏠", label: "דף הבית" },
  { path: "/schedule", icon: "📋", label: "משימות" },
  { path: "/history", icon: "📊", label: "דיווח עבר" },
  { path: "/send-message", icon: "✉️", label: "שליחת הודעה למפקד" },
  { path: "/messages", icon: "🔔", label: "הודעות" },
  { path: "/ai-chat", icon: "🤖", label: "צ'אט AI" },
  { path: "/help", icon: "❓", label: "עזרה" },
  { path: "/settings", icon: "⚙️", label: "הגדרות" },
];

const commanderExtra = [
  { path: "/files", icon: "📁", label: "ניהול קבצים" },
];

export default function Sidebar() {
  const { userProfile, logout, isCommander } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const navItems = isCommander
    ? [soldierNav[0], ...commanderExtra, ...soldierNav.slice(1)]
    : soldierNav;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (!userProfile) return null;

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-header">
          <div style={{ fontSize: "2rem", marginBottom: 4 }}>🪖</div>
          <div className="sidebar-title">שבצ"ק שמירות</div>
          <div className="sidebar-subtitle">מערכת שיבוץ חיילים</div>
        </div>

        <div className="sidebar-user">
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
            שלום, {userProfile.displayName || userProfile.username}
          </div>
          <div style={{ fontSize: "0.78rem", opacity: 0.7, marginTop: 2 }}>
            {isCommander ? "🎖️ מפקד" : "👤 חייל"} •{" "}
            {new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>

        <div className="sidebar-nav">
          {navItems.map(item => (
            <div
              key={item.path}
              className={`sidebar-nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div
            className="sidebar-nav-item"
            onClick={() => setShowLogoutModal(true)}
            style={{ color: "#ff8a80", padding: "10px 4px" }}
          >
            <span className="sidebar-nav-icon">🚪</span>
            <span>התנתק</span>
          </div>
        </div>
      </nav>

      {showLogoutModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>התנתקות</h3>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>🚪</div>
              <p>האם אתה בטוח שאתה רוצה להתנתק?</p>
            </div>
            <div className="modal-footer" style={{ justifyContent: "center", gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setShowLogoutModal(false)}>
                אני רוצה להישאר
              </button>
              <button className="btn btn-danger" onClick={handleLogout}>
                מעדיף לצאת
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
