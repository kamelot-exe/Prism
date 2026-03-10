/**
 * Productivity Analytics Engine
 *
 * Computes "planned vs. actual" time usage and other productivity metrics
 * for a given date range, combining Tasks, PlannedEvents, and PomodoroSessions.
 */

import type { Task, PomodoroSession } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayAnalytics {
  date: string; // YYYY-MM-DD
  /** Minutes estimated for all tasks due that day */
  plannedMinutes: number;
  /** Minutes actually scheduled in the day planner */
  scheduledMinutes: number;
  /** Minutes tracked via completed Pomodoro focus sessions */
  actualFocusMinutes: number;
  /** Number of tasks due that day */
  totalTasks: number;
  /** Number of tasks completed */
  completedTasks: number;
  /** Completion rate 0–100 */
  completionRate: number;
  /** Focus efficiency: actualFocusMinutes / scheduledMinutes, capped at 1 */
  focusEfficiency: number;
}

export interface WeekAnalytics {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string;   // YYYY-MM-DD (Sunday)
  days: DayAnalytics[];
  totals: {
    plannedMinutes: number;
    scheduledMinutes: number;
    actualFocusMinutes: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgFocusEfficiency: number;
  };
  /** Best performing day (highest completionRate) */
  bestDay: DayAnalytics | null;
  /** Day with the most actual focus time */
  mostFocusedDay: DayAnalytics | null;
  /** Trend vs. previous week (positive = better) */
  completionRateDelta?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Get the Monday of the week containing `date`.
 */
export function weekStartFor(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Generate a list of YYYY-MM-DD strings for the 7 days starting from `start`.
 */
function weekDates(start: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(start, i)));
}

// ─── Core computation ─────────────────────────────────────────────────────────

/**
 * Compute analytics for a single day.
 */
export function computeDayAnalytics(
  dateStr: string,
  tasks: Task[],
  plannedBlocks: PlannedEvent[],
  pomodoroSessions: PomodoroSession[]
): DayAnalytics {
  // Tasks for this day
  const dayTasks = tasks.filter((t) => {
    if (!t.date) return false;
    return toDateStr(t.date) === dateStr;
  });

  const plannedMinutes = dayTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes ?? 30),
    0
  );
  const totalTasks = dayTasks.length;
  const completedTasks = dayTasks.filter((t) => t.done).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Scheduled minutes from planner blocks
  const dayBlocks = plannedBlocks.filter((b) => toDateStr(b.start) === dateStr);
  const scheduledMinutes = Math.round(
    dayBlocks.reduce(
      (sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 60000,
      0
    )
  );

  // Actual focus minutes from completed Pomodoro sessions
  const dayFocusSessions = pomodoroSessions.filter(
    (s) => s.kind === 'focus' && s.completed && toDateStr(s.startedAt) === dateStr
  );
  const actualFocusMinutes = dayFocusSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );

  const focusEfficiency =
    scheduledMinutes > 0
      ? Math.min(1, actualFocusMinutes / scheduledMinutes)
      : actualFocusMinutes > 0
      ? 1
      : 0;

  return {
    date: dateStr,
    plannedMinutes,
    scheduledMinutes,
    actualFocusMinutes,
    totalTasks,
    completedTasks,
    completionRate,
    focusEfficiency,
  };
}

/**
 * Compute full week analytics.
 */
export function computeWeekAnalytics(
  weekStart: Date,
  tasks: Task[],
  plannedBlocks: PlannedEvent[],
  pomodoroSessions: PomodoroSession[],
  previousWeekCompletionRate?: number
): WeekAnalytics {
  const weekStartStr = toDateStr(weekStart);
  const weekEndDate = addDays(weekStart, 6);
  const weekEndStr = toDateStr(weekEndDate);
  const dates = weekDates(weekStart);

  const days: DayAnalytics[] = dates.map((d) =>
    computeDayAnalytics(d, tasks, plannedBlocks, pomodoroSessions)
  );

  const totals = days.reduce(
    (acc, d) => ({
      plannedMinutes: acc.plannedMinutes + d.plannedMinutes,
      scheduledMinutes: acc.scheduledMinutes + d.scheduledMinutes,
      actualFocusMinutes: acc.actualFocusMinutes + d.actualFocusMinutes,
      totalTasks: acc.totalTasks + d.totalTasks,
      completedTasks: acc.completedTasks + d.completedTasks,
    }),
    { plannedMinutes: 0, scheduledMinutes: 0, actualFocusMinutes: 0, totalTasks: 0, completedTasks: 0 }
  );

  const overallCompletionRate =
    totals.totalTasks > 0
      ? Math.round((totals.completedTasks / totals.totalTasks) * 100)
      : 0;

  const daysWithFocus = days.filter((d) => d.scheduledMinutes > 0 || d.actualFocusMinutes > 0);
  const avgFocusEfficiency =
    daysWithFocus.length > 0
      ? Math.round(
          (daysWithFocus.reduce((s, d) => s + d.focusEfficiency, 0) / daysWithFocus.length) * 100
        )
      : 0;

  const daysWithTasks = days.filter((d) => d.totalTasks > 0);
  const bestDay =
    daysWithTasks.length > 0
      ? daysWithTasks.reduce((best, d) => (d.completionRate >= best.completionRate ? d : best))
      : null;

  const daysWithFocusSessions = days.filter((d) => d.actualFocusMinutes > 0);
  const mostFocusedDay =
    daysWithFocusSessions.length > 0
      ? daysWithFocusSessions.reduce((best, d) =>
          d.actualFocusMinutes >= best.actualFocusMinutes ? d : best
        )
      : null;

  const completionRateDelta =
    previousWeekCompletionRate !== undefined
      ? overallCompletionRate - previousWeekCompletionRate
      : undefined;

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    days,
    totals: {
      ...totals,
      completionRate: overallCompletionRate,
      avgFocusEfficiency,
    },
    bestDay,
    mostFocusedDay,
    completionRateDelta,
  };
}

/**
 * Format minutes to "Xh Ym" or "Ym" string.
 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Return a qualitative label for a completion rate.
 */
export function rateLabel(rate: number): string {
  if (rate >= 90) return 'Excellent';
  if (rate >= 70) return 'Good';
  if (rate >= 50) return 'Fair';
  if (rate >= 30) return 'Low';
  return 'Behind';
}

/**
 * Return a qualitative label for focus efficiency (0-1 float).
 */
export function efficiencyLabel(efficiency: number): string {
  if (efficiency >= 0.9) return 'On target';
  if (efficiency >= 0.7) return 'Good';
  if (efficiency >= 0.4) return 'Moderate';
  return 'Low';
}
