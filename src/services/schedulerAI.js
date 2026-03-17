/**
 * AI Scheduler — computes fair, weighted duty assignments.
 *
 * Inputs:
 *   soldiers  — array of soldier objects
 *   tasks     — array of task/mission objects
 *   history   — array of past assignment records
 *   startDate — Date to start scheduling from
 *   days      — number of days to schedule (1 or 7)
 *
 * Returns: array of slot objects { date, startTime, endTime, taskId, taskName, assignedSoldiers }
 */

import { addDays, format, startOfDay } from "date-fns";

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function computeSchedule({ soldiers, tasks, history, startDate, days = 7 }) {
  const activeSoldiers = soldiers.filter(s => s.active !== false);
  const slots = [];

  // Build assignment counter from history (weighted by difficulty)
  const workload = {}; // soldierId → weighted hours
  activeSoldiers.forEach(s => { workload[s.id] = 0; });
  history.forEach(h => {
    if (workload[h.soldierId] !== undefined) {
      const diff = h.difficulty || 1;
      workload[h.soldierId] += diff * (h.hours || 1);
    }
  });

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const currentDate = addDays(startDate, dayOffset);
    const dayOfWeek = currentDate.getDay(); // 0=Sun … 6=Sat

    for (const task of tasks) {
      if (!isTaskActiveOnDay(task, dayOfWeek)) continue;

      const timeSlots = getTimeSlots(task);
      for (const slot of timeSlots) {
        const needed = task.participantsNeeded || 1;
        const available = getAvailableSoldiers(activeSoldiers, currentDate, slot, workload, task);
        const assigned = pickBest(available, needed, task);

        if (assigned.length === 0) continue;

        // Update workload
        const hours = slotHours(slot);
        assigned.forEach(s => {
          workload[s.id] = (workload[s.id] || 0) + (task.difficulty || 1) * hours;
        });

        slots.push({
          date: format(currentDate, "yyyy-MM-dd"),
          startTime: slot.start,
          endTime: slot.end,
          taskId: task.id,
          taskName: task.name,
          difficulty: task.difficulty || 1,
          assignedSoldiers: assigned.map(s => ({ id: s.id, name: s.name })),
          dayOfWeek: DAY_NAMES_HE[dayOfWeek]
        });
      }
    }
  }

  return slots;
}

function isTaskActiveOnDay(task, dayOfWeek) {
  if (!task.activeDays || task.activeDays.length === 0) return true;
  return task.activeDays.includes(dayOfWeek);
}

function getTimeSlots(task) {
  if (task.timeSlots && task.timeSlots.length > 0) return task.timeSlots;
  return [{ start: "00:00", end: "23:59" }];
}

function getAvailableSoldiers(soldiers, date, slot, workload, task) {
  return soldiers.filter(s => {
    if (!isSoldierAvailable(s, date, slot)) return false;
    return true;
  }).sort((a, b) => {
    // Lower workload = higher priority
    const wA = workload[a.id] || 0;
    const wB = workload[b.id] || 0;
    // Factor in personal preference for this task
    const prefA = getSoldierPreference(a, task.id);
    const prefB = getSoldierPreference(b, task.id);
    // Score: lower is better
    const scoreA = wA - prefA * 2;
    const scoreB = wB - prefB * 2;
    return scoreA - scoreB;
  });
}

function isSoldierAvailable(soldier, date, slot) {
  // Check leaves
  if (soldier.leaves && soldier.leaves.length > 0) {
    for (const leave of soldier.leaves) {
      const leaveStart = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
      const leaveEnd = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
      if (date >= startOfDay(leaveStart) && date <= startOfDay(leaveEnd)) {
        return false;
      }
    }
  }
  // Check active days
  const dayOfWeek = date.getDay();
  if (soldier.activeDays && soldier.activeDays.length > 0) {
    if (!soldier.activeDays.includes(dayOfWeek)) return false;
  }
  return true;
}

function getSoldierPreference(soldier, taskId) {
  if (!soldier.preferences) return 3;
  return soldier.preferences[taskId] || 3;
}

function pickBest(sortedSoldiers, needed, task) {
  return sortedSoldiers.slice(0, needed);
}

function slotHours(slot) {
  const [sh, sm] = slot.start.split(":").map(Number);
  const [eh, em] = slot.end.split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60; // overnight
  return (endMins - startMins) / 60;
}

// ── Natural language Q&A helper ────────────────────────────────────────────

export function answerScheduleQuestion(question, slots, soldiers, workload) {
  const q = question.toLowerCase();

  if (q.includes("כמה שמירות") || q.includes("כמה פעמים")) {
    const nameMatch = soldiers.find(s => q.includes(s.name));
    if (nameMatch) {
      const count = slots.filter(sl =>
        sl.assignedSoldiers.some(a => a.id === nameMatch.id)
      ).length;
      return `${nameMatch.name} שובץ/ה ${count} פעמים בתקופה המוצגת.`;
    }
  }

  if (q.includes("מי הכי פנוי") || q.includes("מי פנוי")) {
    const sorted = [...soldiers].sort((a, b) => (workload[a.id] || 0) - (workload[b.id] || 0));
    const top = sorted.slice(0, 3).map(s => s.name).join(", ");
    return `החיילים עם עומס הנמוך ביותר כרגע: ${top}`;
  }

  if (q.includes("למה") && q.includes("שובצ")) {
    return "השיבוץ מחושב לפי עומס עבר, רמת קושי המשימה, העדפות אישיות וזמינות. חייל עם עומס נמוך יותר מקבל עדיפות גבוהה יותר לשיבוץ.";
  }

  return "אוכל לענות על שאלות כגון: כמה שמירות עשה [שם], מי הכי פנוי, למה שובצתי, ועוד.";
}
