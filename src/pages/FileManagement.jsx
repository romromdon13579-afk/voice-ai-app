import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getGroupsByCommander, getSoldiersInGroup,
  addSoldierToGroup, deleteSoldier, updateSoldier,
  getUserByUsername
} from "../services/firestoreService.js";

export default function FileManagement() {
  const { currentUser, isCommander } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [addForm, setAddForm] = useState({ username: "", displayName: "", manual: false, role: "soldier" });
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    if (!isCommander) { navigate("/"); return; }
    loadGroups();
  }, [currentUser]);

  useEffect(() => {
    const gId = searchParams.get("group");
    if (gId && groups.length > 0) {
      const found = groups.find(g => g.id === gId);
      if (found) setSelectedGroup(found);
    }
  }, [searchParams, groups]);

  useEffect(() => {
    if (selectedGroup) loadSoldiers();
  }, [selectedGroup]);

  async function loadGroups() {
    setLoading(true);
    try {
      const g = await getGroupsByCommander(currentUser.uid);
      setGroups(g);
      if (g.length > 0) setSelectedGroup(g[0]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSoldiers() {
    if (!selectedGroup) return;
    const s = await getSoldiersInGroup(selectedGroup.id);
    setSoldiers(s);
  }

  async function handleAddSoldier() {
    if (!selectedGroup) return;
    setAddError(""); setAddLoading(true);
    try {
      let soldierData;
      if (addForm.manual) {
        soldierData = { displayName: addForm.displayName, name: addForm.displayName, uid: null, role: addForm.role };
      } else {
        const user = await getUserByUsername(addForm.username);
        if (!user) {
          setAddError("שם משתמש לא נמצא במערכת.");
          return;
        }
        soldierData = { displayName: user.displayName, name: user.displayName, uid: user.id, username: addForm.username, role: addForm.role };
      }
      await addSoldierToGroup(selectedGroup.id, soldierData);
      await loadSoldiers();
      setShowAddModal(false);
      setAddForm({ username: "", displayName: "", manual: false, role: "soldier" });
    } catch (err) {
      setAddError("שגיאה בהוספת החייל.");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDeleteSoldier(soldierId) {
    if (!confirm("האם אתה בטוח שברצונך להסיר את החייל מהקבוצה?")) return;
    await deleteSoldier(selectedGroup.id, soldierId);
    await loadSoldiers();
  }

  async function handleToggleActive(soldier) {
    await updateSoldier(selectedGroup.id, soldier.id, { active: !soldier.active });
    await loadSoldiers();
  }

  const filtered = soldiers.filter(s =>
    s.name?.includes(search) || s.displayName?.includes(search)
  );

  function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>📁</span>
          <h2>ניהול קבצי שמירות</h2>
          <div style={{ marginRight: "auto", display: "flex", gap: 10 }}>
            <button className="btn btn-yellow" onClick={() => navigate("/files/new")}>
              + קובץ חדש
            </button>
          </div>
        </div>

        {/* Group Tabs */}
        {groups.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {groups.map(g => (
              <button
                key={g.id}
                className={`btn btn-sm ${selectedGroup?.id === g.id ? "btn-primary" : "btn-outline"}`}
                onClick={() => setSelectedGroup(g)}
              >
                📁 {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="card"><div className="loading-overlay"><div className="spinner" /></div></div>
      ) : groups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <h3>אין קבצי שמירות עדיין</h3>
            <p>צור קובץ שמירות ראשון כדי להתחיל</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/files/new")}>
              + צור קובץ ראשון
            </button>
          </div>
        </div>
      ) : selectedGroup && (
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: "1.4rem" }}>👥</span>
            <h2>חיילים — {selectedGroup.name}</h2>
            <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
              <button className="icon-btn" title="שיתוף קובץ" onClick={() => setShowShareModal(true)}>📤</button>
              <button className="icon-btn" title="הגדרות קובץ" onClick={() => navigate(`/files/new?edit=${selectedGroup.id}`)}>⚙️</button>
            </div>
          </div>

          {/* Search */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              className="form-input"
              placeholder="🔍 חיפוש חייל..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + הוסף חייל
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <p>לא נמצאו חיילים</p>
            </div>
          ) : (
            <div>
              {filtered.map(soldier => (
                <div key={soldier.id} className="soldier-row">
                  <div
                    className="soldier-avatar"
                    style={{ background: soldier.active === false ? "var(--gray-300)" : undefined }}
                  >
                    {getInitials(soldier.name || soldier.displayName)}
                  </div>
                  <div className="soldier-info">
                    <div className="soldier-name">{soldier.name || soldier.displayName}</div>
                    <div className="soldier-sub">
                      {soldier.username && <span>@{soldier.username} • </span>}
                      <span className={`badge ${soldier.active === false ? "badge-gray" : "badge-success"}`}>
                        {soldier.active === false ? "לא פעיל" : "פעיל"}
                      </span>
                      {soldier.role === "commander" && (
                        <span className="badge badge-warning" style={{ marginRight: 4 }}>⭐ מפקד משימה</span>
                      )}
                    </div>
                  </div>
                  <div className="soldier-actions">
                    <button className="icon-btn" title="טלפון">📞</button>
                    <button
                      className="icon-btn"
                      title="פרופיל וסטטיסטיקה"
                      onClick={() => navigate(`/soldier/${soldier.id}?group=${selectedGroup.id}`)}
                    >✏️</button>
                    <button
                      className="icon-btn"
                      title="שלח הודעה"
                      onClick={() => navigate(`/send-message?to=${soldier.id}`)}
                    >💬</button>
                    <button
                      className="icon-btn"
                      title={soldier.active === false ? "הפעל" : "השבת"}
                      onClick={() => handleToggleActive(soldier)}
                    >
                      {soldier.active === false ? "✅" : "⏸️"}
                    </button>
                    <button
                      className="icon-btn danger"
                      title="הסר מהקבוצה"
                      onClick={() => handleDeleteSoldier(soldier.id)}
                    >🗑️</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, color: "var(--gray-500)", fontSize: "0.85rem" }}>
                סה"כ {filtered.length} חיילים
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Soldier Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>הוספת חייל לקבוצה</h3>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {addError && <div className="alert alert-danger">{addError}</div>}

              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <button
                  className={`btn btn-sm ${!addForm.manual ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setAddForm({ ...addForm, manual: false })}
                >
                  לפי שם משתמש
                </button>
                <button
                  className={`btn btn-sm ${addForm.manual ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setAddForm({ ...addForm, manual: true })}
                >
                  הוספה ידנית
                </button>
              </div>

              {addForm.manual ? (
                <div className="form-group">
                  <label className="form-label">שם החייל</label>
                  <input
                    className="form-input"
                    placeholder="שם מלא"
                    value={addForm.displayName}
                    onChange={e => setAddForm({ ...addForm, displayName: e.target.value })}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">שם משתמש (לדוגמה: מישל לוי123)</label>
                  <input
                    className="form-input"
                    placeholder="username123"
                    value={addForm.username}
                    onChange={e => setAddForm({ ...addForm, username: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">תפקיד בשמירה</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${addForm.role === "soldier" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setAddForm({ ...addForm, role: "soldier" })}
                  >
                    🪖 חייל
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${addForm.role === "commander" ? "btn-yellow" : "btn-outline"}`}
                    onClick={() => setAddForm({ ...addForm, role: "commander" })}
                  >
                    ⭐ מפקד משימה
                  </button>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginTop: 6 }}>
                  מפקד משימה ישובץ כמפקד בכל פעילות, חייל ישובץ כחייל רגיל.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddModal(false)}>ביטול</button>
              <button className="btn btn-primary" onClick={handleAddSoldier} disabled={addLoading}>
                {addLoading ? "מוסיף..." : "הוסף חייל"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>שיתוף קובץ שמירות</h3>
              <button className="icon-btn" onClick={() => setShowShareModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                🔒 שיתוף מבוקר — רק המפקד רשאי לשתף את הקובץ
              </div>
              <p style={{ color: "var(--gray-700)", marginBottom: 16 }}>
                מזהה הקובץ: <strong>{selectedGroup?.id}</strong>
              </p>
              <p style={{ fontSize: "0.88rem", color: "var(--gray-500)" }}>
                שתף את מזהה הקובץ עם חיילים שיצטרכו גישה. הם יוכלו להצטרף דרך הגדרות הפרופיל שלהם.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => { navigator.clipboard.writeText(selectedGroup?.id); alert("הועתק!"); }}
              >
                📋 העתק מזהה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
