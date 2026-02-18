// src/utils/healing.ts

/**
 * Returns the current day number (1-based) since `startDate`.
 * - startDate: ISO string like "2025-01-01" or any date string parseable by Date()
 * - Uses local time days (not UTC) to avoid “yesterday/today” drift.
 */
export function getCurrentDay(startDate: string): number {
  if (!startDate) return 1;

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 1;

  const now = new Date();

  // Normalize both to local midnight to avoid timezone/hour differences
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = nowMidnight.getTime() - startMidnight.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Day is 1-based
  return Math.max(1, diffDays + 1);
}
