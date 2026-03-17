/**
 * schedulerAI.js
 * ─────────────────────────────────────────────────────────────────────────
 * Primary scheduler: delegates to Gemini API.
 * Fallback: local weighted algorithm (used when Gemini is unavailable).
 */

import { addDays, format, startOfDay } from "date-fns";
import { geminiSchedule, isGeminiConfigured } from "./geminiService.js";

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// ── Public entry point ─────────────────────────────────────────────────────
// Returns { slots, usedAI } where usedAI is true when Gemini was used.

export async function computeSchedule({ soldiers, tasks, history, startDate, days = 7, requirements = "" }) {
  if (isGeminiConfigured()) {
    try {
      const slots = await geminiSchedule({ soldiers, tasks, history, startDate, days, requirements });
      if (slots && slots.length > 0) {
        return { slots, usedAI: true };
      }
    } catch (err) {
      console.warn("Gemini scheduler failed, falling back to local algorithm:", err.message);
    }
  }

  // ── Local fallback ──────────────────────────────────────────────────────
  const slots = computeLocalSchedule({ soldiers, tasks, history, startDate, days });
  return { slots, usedAI: false };
}

// ── Local weighted scheduler (original algorithm) ──────────────────────────

export function computeLocalSchedule({ soldiers, tasks, history, startDate, days = 7 }) {
  const activeSoldiers = soldiers.filter(s => s.active !== false);
  const slots = [];

  const workload = {};
  activeSoldiers.forEach(s => { workload[s.id] = 0; });
  history.forEach(h => {
    if (workload[h.soldierId] !== undefined) {
      workload[h.soldierId] += (h.difficulty || 1) * (h.hours || 1);
    }
  });

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const currentDate = addDays(startDate, dayOffset);
    const dayOfWeek = currentDate.getDay();

    for (const task of tasks) {
      if (!isTaskActiveOnDay(task, dayOfWeek)) continue;

      for (const slot of getTimeSlots(task)) {
        const needed = task.participantsNeeded || 1;
        const available = getAvailableSoldiers(activeSoldiers, currentDate, slot, workload, task);
        const assigned = available.slice(0, needed);
        if (assigned.length === 0) continue;

        const hours = slotHours(slot);
        assigned.forEach(s => {
          workload[s.id] = (workload[s.id] || 0) + (task.difficulty || 1) * hours;
        });

        // Separate task commander (role=commander) from regular soldiers
        const commanderAssigned = assigned.find(s => s.role === "commander") || null;
        const regularSoldiers = assigned.filter(s => s.role !== "commander");

        slots.push({
          date: format(currentDate, "yyyy-MM-dd"),
          startTime: slot.start,
          endTime: slot.end,
          taskId: task.id,
          taskName: task.name,
          difficulty: task.difficulty || 1,
          taskCommander: commanderAssigned ? { id: commanderAssigned.id, name: commanderAssigned.name || commanderAssigned.displayName } : null,
          assignedSoldiers: regularSoldiers.map(s => ({ id: s.id, name: s.name || s.displayName })),
          dayOfWeek: DAY_NAMES_HE[dayOfWeek]
        });
      }
    }
  }

  return slots;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isTaskActiveOnDay(task, dayOfWeek) {
  if (!task.activeDays || task.activeDays.length === 0) return true;
  return task.activeDays.includes(dayOfWeek);
}

function getTimeSlots(task) {
  if (task.timeSlots && task.timeSlots.length > 0) return task.timeSlots;
  return [{ start: "00:00", end: "23:59" }];
}

function getAvailableSoldiers(soldiers, date, slot, workload, task) {
  return soldiers
    .filter(s => isSoldierAvailable(s, date))
    .sort((a, b) => {
      const scoreA = (workload[a.id] || 0) - getSoldierPreference(a, task.id) * 2;
      const scoreB = (workload[b.id] || 0) - getSoldierPreference(b, task.id) * 2;
      return scoreA - scoreB;
    });
}

function isSoldierAvailable(soldier, date) {
  if (soldier.leaves?.length > 0) {
    for (const leave of soldier.leaves) {
      const leaveStart = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
      const leaveEnd   = leave.endDate?.toDate   ? leave.endDate.toDate()   : new Date(leave.endDate);
      if (date >= startOfDay(leaveStart) && date <= startOfDay(leaveEnd)) return false;
    }
  }
  const dayOfWeek = date.getDay();
  if (soldier.activeDays?.length > 0 && !soldier.activeDays.includes(dayOfWeek)) return false;
  return true;
}

function getSoldierPreference(soldier, taskId) {
  return soldier.preferences?.[taskId] ?? 3;
}

function slotHours(slot) {
  const [sh, sm] = slot.start.split(":").map(Number);
  const [eh, em] = slot.end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 1440;
  return mins / 60;
}
