import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { updateUserProfile } from "../services/firestoreService.js";
import {
  updatePassword, EmailAuthProvider, reauthenticateWithCredential
} from "firebase/auth";
import { auth } from "../firebase.js";

function getNotifPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export default function Settings() {
  const { currentUser, userProfile, setUserProfile } = useAuth();

  const [profileForm, setProfileForm] = useState({
    displayName: userProfile?.displayName || "",
    idNumber: userProfile?.idNumber || ""
  });

  const [passwordForm, setPasswordForm] = useState({
    current: "", next: "", confirm: ""
  });

  const [notifSettings, setNotifSettings] = useState({
    dailyReminderEnabled: userProfile?.notif?.dailyReminderEnabled ?? true,
    dailyReminderTime: userProfile?.notif?.dailyReminderTime || "07:00",
    preShiftReminder: userProfile?.notif?.preShiftReminder || 30
  });

  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [passError, setPassError] = useState("");
  const [notifSuccess, setNotifSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifPermission, setNotifPermission] = useState(getNotifPermission);

  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true); setProfileError(""); setProfileSuccess("");
    try {
      await updateUserProfile(currentUser.uid, {
        displayName: profileForm.displayName,
        idNumber: profileForm.idNumber
      });
      setUserProfile(prev => ({ ...prev, displayName: profileForm.displayName }));
      setProfileSuccess("הפרטים עודכנו בהצלחה!");
    } catch {
      setProfileError("שגיאה בשמירת הפרטים.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPassError(""); setPassSuccess("");
    if (passwordForm.next !== passwordForm.confirm) {
      return setPassError("הסיסמאות החדשות אינן תואמות.");
    }
    if (passwordForm.next.length < 6) return setPassError("הסיסמה חייבת להכיל לפחות 6 תווים.");
    setSaving(true);
    try {
      const cred = EmailAuthProvider.credential(currentUser.email, passwordForm.current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, passwordForm.next);
      setPassSuccess("הסיסמה שונתה בהצלחה!");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPassError(err.code === "auth/wrong-password" ? "הסיסמה הנוכחית שגויה." : "שגיאה בשינוי הסיסמה.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotifications(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile(currentUser.uid, { notif: notifSettings });
      setNotifSuccess("הגדרות ההתראות נשמרו!");
      setTimeout(() => setNotifSuccess(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>⚙️</span>
          <h2>הגדרות</h2>
        </div>
      </div>

      {/* Personal info */}
      <div className="card">
        <div className="card-header"><span>👤</span><h3>פרטים אישיים</h3></div>
        {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}
        {profileError && <div className="alert alert-danger">{profileError}</div>}
        <form onSubmit={saveProfile}>
          <div className="form-group">
            <label className="form-label">שם מלא</label>
            <input
              className="form-input"
              value={profileForm.displayName}
              onChange={e => setProfileForm({ ...profileForm, displayName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">כתובת מייל</label>
            <input className="form-input" value={currentUser?.email || ""} disabled style={{ background: "var(--gray-100)" }} />
          </div>
          <div className="form-group">
            <label className="form-label">תעודת זהות</label>
            <input
              className="form-input"
              value={profileForm.idNumber}
              onChange={e => setProfileForm({ ...profileForm, idNumber: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">שם משתמש</label>
            <input className="form-input" value={userProfile?.username || ""} disabled style={{ background: "var(--gray-100)" }} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "שומר..." : "💾 שמור פרטים"}
          </button>
        </form>
      </div>

      {/* Password change */}
      <div className="card">
        <div className="card-header"><span>🔐</span><h3>שינוי סיסמה</h3></div>
        {passSuccess && <div className="alert alert-success">{passSuccess}</div>}
        {passError && <div className="alert alert-danger">{passError}</div>}
        <form onSubmit={changePassword}>
          <div className="form-group">
            <label className="form-label">סיסמה נוכחית</label>
            <input
              className="form-input" type="password"
              value={passwordForm.current}
              onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">סיסמה חדשה</label>
            <input
              className="form-input" type="password"
              value={passwordForm.next}
              onChange={e => setPasswordForm({ ...passwordForm, next: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">אימות סיסמה חדשה</label>
            <input
              className="form-input" type="password"
              value={passwordForm.confirm}
              onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "מעדכן..." : "🔒 שנה סיסמה"}
          </button>
        </form>
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="card-header"><span>🔔</span><h3>הגדרות התראות</h3></div>

        {/* Browser notification permission status */}
        <div style={{ marginBottom: 20, padding: 14, background: "var(--gray-100)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong>התראות דפדפן</strong>
            <div style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginTop: 2 }}>
              {notifPermission === "granted"  && "✅ התראות מאופשרות — תקבל תזכורות לפני משמרות והודעות חדשות."}
              {notifPermission === "denied"   && "❌ התראות חסומות — שנה את ההרשאה ישירות בהגדרות הדפדפן."}
              {notifPermission === "default"  && "⚠️ לא הורשו עדיין — לחץ לאפשר."}
              {notifPermission === "unsupported" && "הדפדפן שלך אינו תומך בהתראות."}
            </div>
          </div>
          {notifPermission === "default" && (
            <button className="btn btn-primary btn-sm" onClick={requestNotifPermission}>
              🔔 אפשר התראות
            </button>
          )}
        </div>

        {notifSuccess && <div className="alert alert-success">{notifSuccess}</div>}
        <form onSubmit={saveNotifications}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={notifSettings.dailyReminderEnabled}
                onChange={e => setNotifSettings({ ...notifSettings, dailyReminderEnabled: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
            <span style={{ fontWeight: 600 }}>תזכורת יומית לדיווח</span>
          </div>

          {notifSettings.dailyReminderEnabled && (
            <div className="form-group" style={{ maxWidth: 160, marginBottom: 16 }}>
              <label className="form-label">שעת התזכורת</label>
              <input
                type="time" className="form-input"
                value={notifSettings.dailyReminderTime}
                onChange={e => setNotifSettings({ ...notifSettings, dailyReminderTime: e.target.value })}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">תזכורת לפני שמירה</label>
            <select
              className="form-select"
              style={{ maxWidth: 200 }}
              value={notifSettings.preShiftReminder}
              onChange={e => setNotifSettings({ ...notifSettings, preShiftReminder: Number(e.target.value) })}
            >
              <option value={15}>15 דקות מראש</option>
              <option value={30}>30 דקות מראש</option>
              <option value={45}>45 דקות מראש</option>
              <option value={60}>60 דקות מראש</option>
            </select>
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "שומר..." : "💾 שמור הגדרות התראות"}
          </button>
        </form>
      </div>
    </div>
  );
}
