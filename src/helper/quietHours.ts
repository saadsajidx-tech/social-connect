// src/utilities/notifications/quietHoursHelper.ts
// ─────────────────────────────────────────────────────────────────────────────
// Determines whether the current local time falls within a quiet hours window.
// Handles windows that span midnight (e.g., 22:00 → 07:00).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the current time is inside the quiet hours window.
 *
 * @param start - "HH:MM" string, e.g. "22:00"
 * @param end   - "HH:MM" string, e.g. "07:00"
 *
 * Examples:
 *   isQuietHoursActive("22:00", "07:00") at 23:30 → true   (spans midnight)
 *   isQuietHoursActive("22:00", "07:00") at 06:59 → true   (still in window)
 *   isQuietHoursActive("22:00", "07:00") at 12:00 → false
 *   isQuietHoursActive("08:00", "20:00") at 14:00 → true   (same day)
 */
export function isQuietHoursActive(start: string, end: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    // Window is within the same day: e.g. 08:00 → 20:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Window spans midnight: e.g. 22:00 → 07:00
    // Active if: currentTime >= 22:00  OR  currentTime < 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}
