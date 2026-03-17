/**
 * useNotifications.js
 * ──────────────────────────────────────────────────────────────────────────
 * Browser notification hook (no backend required).
 *
 * Features:
 *   1. Requests Notification API permission on first use.
 *   2. Subscribes to Firestore messages in real-time — fires a desktop
 *      notification whenever a new message arrives.
 *   3. Schedules pre-shift reminders for today's assigned slots using
 *      setTimeout (active only while the tab is open).
 */

import { useEffect, useRef } from "react";
import { subscribeToMessages } from "../services/firestoreService";

// ── Public hook ────────────────────────────────────────────────────────────

export function useNotifications({ currentUser, userProfile, groups = [], todaySlots = [] }) {
  const seenIds      = useRef(new Set());   // avoid duplicate notifications
  const timers       = useRef([]);          // pre-shift setTimeout handles
  const initialized  = useRef(false);       // first snapshot flag

  // 1. Request browser notification permission once on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // 2. Real-time message notifications
  useEffect(() => {
    if (!currentUser || !groups.length) return;

    const unsubs = groups.map(group =>
      subscribeToMessages(group.id, currentUser.uid, msgs => {
        // On the very first snapshot just seed the seen-set (no popup)
        if (!initialized.current) {
          msgs.forEach(m => seenIds.current.add(m.id));
          initialized.current = true;
          return;
        }
        msgs.forEach(m => {
          if (!seenIds.current.has(m.id)) {
            seenIds.current.add(m.id);
            fireNotification(
              `📨 הודעה חדשה: ${m.title || "ללא נושא"}`,
              { body: (m.body || "").slice(0, 100), icon: "/favicon.svg" }
            );
          }
        });
      })
    );

    return () => {
      unsubs.forEach(u => u());
      initialized.current = false;
    };
  }, [currentUser, groups]);

  // 3. Pre-shift reminders — re-schedule whenever todaySlots or settings change
  useEffect(() => {
    if (!currentUser || !todaySlots.length) return;

    const preMinutes = userProfile?.notif?.preShiftReminder ?? 30;

    // Clear previously scheduled timers
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const mySlots = todaySlots.filter(s =>
      s.assignedSoldiers?.some(a => a.id === currentUser.uid)
    );

    mySlots.forEach(slot => {
      const shiftDate = resolveDate(slot);
      if (!shiftDate) return;

      const alertAt = shiftDate.getTime() - preMinutes * 60_000;
      const delay   = alertAt - Date.now();

      // Only schedule if the reminder is still in the future (within 24 h)
      if (delay > 0 && delay < 86_400_000) {
        const t = setTimeout(() => {
          fireNotification(
            `⏰ תזכורת שמירה — ${slot.taskName}`,
            {
              body: `המשמרת מתחילה בעוד ${preMinutes} דקות (${slot.startTimeStr || ""})`,
              icon: "/favicon.svg"
            }
          );
        }, delay);
        timers.current.push(t);
      }
    });

    return () => timers.current.forEach(clearTimeout);
  }, [currentUser, todaySlots, userProfile]);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fireNotification(title, options = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, options);
  } catch {
    // Silently ignore — some browsers block Notification in certain contexts
  }
}

function resolveDate(slot) {
  try {
    if (slot.startTime?.toDate) return slot.startTime.toDate();
    if (slot.date && slot.startTimeStr) return new Date(`${slot.date}T${slot.startTimeStr}`);
    return null;
  } catch {
    return null;
  }
}
