import React, { useState } from "react";

const VIDEOS = [
  { id: 1, title: "כניסה ראשונה למערכת", icon: "🔐", duration: "2:30", desc: "איך להתחבר, לאפס סיסמה ולפתוח חשבון" },
  { id: 2, title: "בניית קובץ שמירות", icon: "📁", duration: "5:00", desc: "שלב א׳–ג׳: הגדרת משימות, חיילים והיסטוריה" },
  { id: 3, title: "חישוב שיבוץ AI", icon: "🤖", duration: "3:45", desc: "כיצד ה-AI מחשב שיבוץ הוגן ומאוזן" },
  { id: 4, title: "ניהול חיילים", icon: "👥", duration: "4:00", desc: "הוספה, עריכה, חופשות והגדרת עדיפויות" },
  { id: 5, title: "צ׳אט שאלות AI", icon: "💬", duration: "2:15", desc: "איך לשאול שאלות ולקבל הסברים על השיבוץ" },
  { id: 6, title: "שליחת הודעות", icon: "✉️", duration: "1:50", desc: "תקשורת בין חיילים ומפקדים במערכת" },
  { id: 7, title: "דיווחי עבר", icon: "📊", duration: "2:40", desc: "צפייה בהיסטוריית שמירות ונתוני עומס" },
  { id: 8, title: "הגדרות והתאמות", icon: "⚙️", duration: "2:00", desc: "ניהול פרופיל, סיסמה והתראות" },
];

const FAQ = [
  { q: "איך ה-AI מחשב את השיבוץ?", a: "ה-AI לוקח בחשבון: היסטוריית שיבוצים, רמת קושי של כל משימה, עדיפויות אישיות, ימי פעילות וחופשות. הוא מחשב ציון עומס לכל חייל ומשבץ את מי שעמוס פחות קודם." },
  { q: "האם ניתן לשנות שיבוץ שנוצר?", a: "כרגע השיבוץ מחושב מחדש אוטומטית. תכונת עריכה ידנית תתווסף בגרסה הבאה." },
  { q: "מה ההבדל בין מפקד לחייל?", a: "מפקד יכול ליצור קבצים, להוסיף חיילים, לחשב שיבוץ ולשלוח הודעות לכל הקבוצה. חייל רואה את השיבוצים שלו ויכול לשלוח הודעה למפקד." },
  { q: "איך מוסיפים חייל ללא חשבון?", a: "בבניית הקובץ (שלב ב׳) לחץ 'הוספה ידנית' והזן שם. הוא יופיע בשיבוץ גם בלי חשבון." },
  { q: "האם המידע מאובטח?", a: "כן. המידע מאוחסן ב-Firebase עם אבטחה ברמת Firestore Rules. רק מפקד שיצר את הקובץ יכול לשתף גישה." },
];

export default function Help() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: "1.4rem" }}>❓</span>
          <h2>עזרה ותמיכה</h2>
        </div>
        <p style={{ color: "var(--gray-500)" }}>
          מרכז העזרה של שבצ"ק שמירות — סרטוני הדרכה ושאלות נפוצות
        </p>
      </div>

      {/* Video tutorials */}
      <div className="card">
        <div className="card-header"><span>🎬</span><h3>סרטוני הדרכה</h3></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {VIDEOS.map(v => (
            <div
              key={v.id}
              style={{
                background: "var(--gray-100)",
                borderRadius: "var(--radius-sm)",
                padding: 16,
                cursor: "pointer",
                border: "2px solid transparent",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--primary)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
              onClick={() => alert(`סרטון "${v.title}" יתווסף בקרוב 🎥`)}
            >
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>{v.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 4, fontSize: "0.95rem" }}>{v.title}</div>
              <div style={{ color: "var(--gray-500)", fontSize: "0.8rem", marginBottom: 8 }}>{v.desc}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge badge-olive">▶ צפה</span>
                <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>⏱ {v.duration}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="card">
        <div className="card-header"><span>💡</span><h3>שאלות נפוצות</h3></div>
        {FAQ.map((item, i) => (
          <div
            key={i}
            style={{
              borderBottom: i < FAQ.length - 1 ? "1px solid var(--gray-200)" : "none",
              padding: "14px 0"
            }}
          >
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                cursor: "pointer", fontWeight: 600
              }}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <span>{item.q}</span>
              <span style={{ fontSize: "1.2rem" }}>{openFaq === i ? "▲" : "▼"}</span>
            </div>
            {openFaq === i && (
              <div style={{
                marginTop: 10, padding: 12,
                background: "var(--gray-100)", borderRadius: "var(--radius-sm)",
                color: "var(--gray-700)", fontSize: "0.9rem", lineHeight: 1.7
              }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📞</div>
        <h3>צריך עזרה נוספת?</h3>
        <p style={{ color: "var(--gray-500)", marginTop: 8 }}>
          פנה למנהל המערכת של יחידתך
        </p>
      </div>
    </div>
  );
}
