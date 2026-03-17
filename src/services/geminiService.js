/**
 * geminiService.js  (now powered by Groq API — free tier)
 * ─────────────────────────────────────────────────────────────────────────
 * Drop-in replacement for the previous Gemini/Claude implementation.
 * All exported function names are kept identical so no other file needs changes.
 *
 * Configuration:
 *   Add  VITE_GROQ_API_KEY=<your-key>  to a local .env file.
 *   Get a free key (no credit card) at: https://console.groq.com
 *   Never commit the .env file to source control.
 *
 * Exports:
 *   geminiChat(messages, systemPrompt)                              → string
 *   geminiSchedule({ soldiers, tasks, history, startDate, days })  → slots[]
 *   isGeminiConfigured()                                           → boolean
 *   buildChatSystemPrompt({ groupName, soldiers, tasks, slots, workload }) → string
 */

const API_KEY  = import.meta.env.VITE_GROQ_API_KEY;
const MODEL    = "llama-3.3-70b-versatile";
const BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── Public helper ─────────────────────────────────────────────────────────

export function isGeminiConfigured() {
  return Boolean(API_KEY && API_KEY.trim().length > 0);
}

// ── Core fetch wrapper ────────────────────────────────────────────────────

async function callGroq(systemPrompt, userMessage) {
  if (!isGeminiConfigured()) throw new Error("MISSING_API_KEY");

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage  }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ── Multi-turn chat ───────────────────────────────────────────────────────
// messages: [{ role: "user"|"ai", text }]

export async function geminiChat(messages, systemPrompt) {
  if (!isGeminiConfigured()) throw new Error("MISSING_API_KEY");

  // Convert internal format → OpenAI format
  const contents = messages.map(m => ({
    role: m.role === "ai" ? "assistant" : "user",
    content: m.text
  }));

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        ...contents
      ]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ── AI Scheduler ──────────────────────────────────────────────────────────

export async function geminiSchedule({ soldiers, tasks, history, startDate, days }) {
  const activeSoldiers = soldiers.filter(s => s.active !== false);

  const workloadMap = {};
  activeSoldiers.forEach(s => { workloadMap[s.id] = 0; });
  history.forEach(h => {
    if (workloadMap[h.soldierId] !== undefined)
      workloadMap[h.soldierId] += (h.difficulty || 1) * (h.hours || 1);
  });

  const soldiersContext = activeSoldiers.map(s => ({
    id: s.id,
    name: s.name || s.displayName,
    activeDays: s.activeDays ?? [0,1,2,3,4,5,6],
    leaves: (s.leaves || []).map(l => ({
      from: typeof l.startDate === "string" ? l.startDate : l.startDate?.toDate?.()?.toISOString?.() ?? "",
      to:   typeof l.endDate   === "string" ? l.endDate   : l.endDate?.toDate?.()?.toISOString?.() ?? ""
    })),
    preferences: s.preferences || {},
    currentWorkload: Math.round(workloadMap[s.id] || 0)
  }));

  const tasksContext = tasks.map(t => ({
    id: t.id,
    name: t.name,
    difficulty: t.difficulty ?? 3,
    participantsNeeded: t.participantsNeeded ?? 2,
    activeDays: t.activeDays ?? [0,1,2,3,4,5,6],
    timeSlots: t.timeSlots ?? [{ start: "00:00", end: "08:00" }]
  }));

  const startStr = startDate instanceof Date
    ? startDate.toISOString().slice(0, 10)
    : startDate;

  const systemPrompt = `אתה מערכת שיבוץ צבאית מקצועית לצבא ישראל.
תפקידך: לחשב שיבוץ שמירות הוגן ומאוזן לחיילים.

כללים מחייבים:
1. חייל בחופשה — לא ישובץ כלל בתקופת החופשה.
2. ימי פעילות — שבץ חייל רק בימים שהוא פעיל בהם (activeDays: 0=ראשון, 6=שבת).
3. הוגנות — חייל עם currentWorkload נמוך יותר יקבל עדיפות גבוהה יותר.
4. העדפות — preferences[taskId] גבוה יותר = עדיפות גבוהה יותר לאותה משימה.
5. participantsNeeded — שבץ בדיוק את הכמות הנדרשת לכל משימה בכל סבב.
6. כיסוי מלא — כסה את כל הסבבים של כל משימה בכל יום פעיל.

פורמט תגובה — JSON בלבד, ללא הסברים, ללא markdown, ללא קוד-בלוק:
{
  "slots": [
    {
      "date": "YYYY-MM-DD",
      "dayOfWeek": "שם היום בעברית",
      "taskId": "...",
      "taskName": "...",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "difficulty": 1-5,
      "assignedSoldiers": [{"id":"...","name":"..."}]
    }
  ]
}`;

  const userMessage = `
תאריך התחלה: ${startStr}
מספר ימים לשיבוץ: ${days}

חיילים פעילים:
${JSON.stringify(soldiersContext, null, 2)}

משימות:
${JSON.stringify(tasksContext, null, 2)}

החזר שיבוץ מלא ל-${days} ימים החל מ-${startStr}.
`;

  const raw = await callGroq(systemPrompt, userMessage);
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return parsed.slots ?? [];
}

// ── Chat system prompt builder ─────────────────────────────────────────────

export function buildChatSystemPrompt({ groupName, soldiers, tasks, slots, workload }) {
  const soldiersStr = soldiers.map(s => {
    const wl = workload[s.id] || 0;
    const assignedCount = slots.filter(sl =>
      sl.assignedSoldiers?.some(a => a.id === s.id)
    ).length;
    return `- ${s.name || s.displayName}: עומס=${Math.round(wl)}, שמירות ב-30 יום=${assignedCount}, פעיל=${s.active !== false ? "כן" : "לא"}`;
  }).join("\n");

  const tasksStr = tasks.map(t =>
    `- ${t.name}: קושי ${t.difficulty}, נדרשים ${t.participantsNeeded} משתתפים`
  ).join("\n");

  const recentSlots = slots.slice(0, 50).map(sl =>
    `${sl.date} ${sl.startTimeStr || sl.startTime}–${sl.endTimeStr || sl.endTime}: ${sl.taskName} → ${sl.assignedSoldiers?.map(a => a.name).join(", ")}`
  ).join("\n");

  return `אתה עוזר AI חכם של מערכת שבצ"ק שמירות לקבוצה "${groupName || "הקבוצה"}".
תפקידך: לענות בעברית על שאלות בנוגע לשיבוצים, עומסי חיילים, והסברים על החלטות השיבוץ.

נתוני הקבוצה:
== חיילים ==
${soldiersStr || "אין נתונים"}

== משימות ==
${tasksStr || "אין נתונים"}

== שיבוצים אחרונים (30 יום) ==
${recentSlots || "אין שיבוצים עדיין"}

הנחיות:
- ענה תמיד בעברית, בשפה ידידותית וצבאית מקצועית.
- התבסס אך ורק על הנתונים שקיבלת — אל תמציא מידע.
- אם אין מידע מספק, ציין זאת בכנות.
- כשמסבירים שיבוץ — ציין את הסיבות: עומס, עדיפות, זמינות.`;
}
