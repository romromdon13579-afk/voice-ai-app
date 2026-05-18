import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const soldierNav = [
  { path: "/",            icon: "🏠", label: "דף הבית" },
  { path: "/schedule",    icon: "📋", label: "משימות" },
  { path: "/history",     icon: "📊", label: "דיווח עבר" },
  { path: "/send-message",icon: "✉️", label: "שליחת הודעה למפקד" },
  { path: "/messages",    icon: "🔔", label: "הודעות" },
  { path: "/ai-chat",     icon: "🤖", label: "צ'אט AI" },
  { path: "/complex",     icon: "🔢", label: "מספרים מרוכבים" },
  { path: "/help",        icon: "❓", label: "עזרה" },
  { path: "/settings",    icon: "⚙️", label: "הגדרות" },
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
        {/* Header */}
        <div className="sidebar-header">
          <img src="/favicon.svg" alt="לוגו" className="sidebar-logo-img" />
          <div className="sidebar-title">ניהול שבצ"ק חכם</div>
          <div className="sidebar-subtitle">מערכת שיבוץ חיילים</div>
        </div>

        {/* User info */}
        <div className="sidebar-user">
          <div className="sidebar-user-name">
            שלום, {userProfile.displayName || userProfile.username}
          </div>
          <div className="sidebar-user-meta">
            <span className="sidebar-user-badge">
              {isCommander ? "🎖️ מפקד" : "👤 חייל"}
            </span>
            <span>
              {new Date().toLocaleDateString("he-IL", {
                weekday: "short",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          {navItems.map(item => (
            <div
              key={item.path}
              className={`sidebar-nav-item${location.pathname === item.path ? " active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Footer / Logout */}
        <div className="sidebar-footer">
          <button
            className="sidebar-logout-btn"
            onClick={() => setShowLogoutModal(true)}
          >
            <span className="sidebar-nav-icon">🚪</span>
            <span>התנתק</span>
          </button>
        </div>
      </nav>

      {showLogoutModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>התנתקות מהמערכת</h3>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.8rem", marginBottom: 14 }}>🚪</div>
              <p style={{ color: "var(--gray-600)" }}>
                האם אתה בטוח שאתה רוצה להתנתק?
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: "center" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowLogoutModal(false)}
              >
                ביטול
              </button>
              <button className="btn btn-danger" onClick={handleLogout}>
                כן, התנתק
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
