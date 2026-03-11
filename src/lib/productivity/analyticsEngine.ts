import type { Task, PomodoroSession, FocusSessionRecord } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';

export interface DayAnalytics {
  date: string;
  plannedMinutes: number;
  scheduledMinutes: number;
  actualFocusMinutes: number;
  linkedActualMinutes: number;
  unlinkedActualMinutes: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  focusEfficiency: number;
}

export interface WeekAnalytics {
  weekStart: string;
  weekEnd: string;
  days: DayAnalytics[];
  totals: {
    plannedMinutes: number;
    scheduledMinutes: number;
    actualFocusMinutes: number;
    linkedActualMinutes: number;
    unlinkedActualMinutes: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgFocusEfficiency: number;
  };
  bestDay: DayAnalytics | null;
  mostFocusedDay: DayAnalytics | null;
  completionRateDelta?: number;
  caveats: string[];
}

type ActualFocusEntry = {
  startedAt: string;
  durationMinutes: number;
  taskId?: number | null;
  plannedBlockId?: number | null;
};

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

export function weekStartFor(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekDates(start: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(start, i)));
}

function toActualFocusEntries(
  pomodoroSessions: PomodoroSession[],
  focusSessions: FocusSessionRecord[]
): ActualFocusEntry[] {
  const pomodoroEntries = pomodoroSessions
    .filter((session) => session.kind === 'focus' && session.completed && session.durationMinutes > 0)
    .map((session) => ({
      startedAt: session.startedAt,
      durationMinutes: session.durationMinutes,
      taskId: session.taskId ?? null,
      plannedBlockId: null,
    }));

  const focusEntries = focusSessions
    .filter((session) => (session.durationMinutes ?? 0) > 0)
    .map((session) => ({
      startedAt: session.startedAt,
      durationMinutes: session.durationMinutes ?? 0,
      taskId: session.taskId ?? null,
      plannedBlockId: session.plannedBlockId ?? null,
    }));

  return [...pomodoroEntries, ...focusEntries];
}

export function computeDayAnalytics(
  dateStr: string,
  tasks: Task[],
  plannedBlocks: PlannedEvent[],
  pomodoroSessions: PomodoroSession[],
  focusSessions: FocusSessionRecord[] = []
): DayAnalytics {
  const dayTasks = tasks.filter((task) => task.date && toDateStr(task.date) === dateStr);
  const plannedMinutes = dayTasks.reduce((sum, task) => sum + Math.max(0, task.estimatedMinutes ?? 30), 0);
  const totalTasks = dayTasks.length;
  const completedTasks = dayTasks.filter((task) => task.done).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const dayBlocks = plannedBlocks.filter((block) => toDateStr(block.start) === dateStr);
  const scheduledMinutes = Math.round(
    dayBlocks.reduce((sum, block) => sum + (block.end.getTime() - block.start.getTime()) / 60000, 0)
  );

  const actualEntries = toActualFocusEntries(pomodoroSessions, focusSessions).filter(
    (entry) => toDateStr(entry.startedAt) === dateStr
  );
  const actualFocusMinutes = actualEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const linkedActualMinutes = actualEntries
    .filter((entry) => entry.taskId != null || entry.plannedBlockId != null)
    .reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const unlinkedActualMinutes = actualFocusMinutes - linkedActualMinutes;

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
    linkedActualMinutes,
    unlinkedActualMinutes,
    totalTasks,
    completedTasks,
    completionRate,
    focusEfficiency,
  };
}

export function computeWeekAnalytics(
  weekStart: Date,
  tasks: Task[],
  plannedBlocks: PlannedEvent[],
  pomodoroSessions: PomodoroSession[],
  focusSessions: FocusSessionRecord[] = [],
  previousWeekCompletionRate?: number
): WeekAnalytics {
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr = toDateStr(addDays(weekStart, 6));
  const dates = weekDates(weekStart);

  const days = dates.map((date) => computeDayAnalytics(date, tasks, plannedBlocks, pomodoroSessions, focusSessions));

  const totals = days.reduce(
    (acc, day) => ({
      plannedMinutes: acc.plannedMinutes + day.plannedMinutes,
      scheduledMinutes: acc.scheduledMinutes + day.scheduledMinutes,
      actualFocusMinutes: acc.actualFocusMinutes + day.actualFocusMinutes,
      linkedActualMinutes: acc.linkedActualMinutes + day.linkedActualMinutes,
      unlinkedActualMinutes: acc.unlinkedActualMinutes + day.unlinkedActualMinutes,
      totalTasks: acc.totalTasks + day.totalTasks,
      completedTasks: acc.completedTasks + day.completedTasks,
    }),
    {
      plannedMinutes: 0,
      scheduledMinutes: 0,
      actualFocusMinutes: 0,
      linkedActualMinutes: 0,
      unlinkedActualMinutes: 0,
      totalTasks: 0,
      completedTasks: 0,
    }
  );

  const overallCompletionRate =
    totals.totalTasks > 0 ? Math.round((totals.completedTasks / totals.totalTasks) * 100) : 0;

  const daysWithFocus = days.filter((day) => day.scheduledMinutes > 0 || day.actualFocusMinutes > 0);
  const avgFocusEfficiency =
    daysWithFocus.length > 0
      ? Math.round((daysWithFocus.reduce((sum, day) => sum + day.focusEfficiency, 0) / daysWithFocus.length) * 100)
      : 0;

  const daysWithTasks = days.filter((day) => day.totalTasks > 0);
  const bestDay = daysWithTasks.length > 0
    ? daysWithTasks.reduce((best, day) => (day.completionRate >= best.completionRate ? day : best))
    : null;

  const daysWithTrackedFocus = days.filter((day) => day.actualFocusMinutes > 0);
  const mostFocusedDay = daysWithTrackedFocus.length > 0
    ? daysWithTrackedFocus.reduce((best, day) => (day.actualFocusMinutes >= best.actualFocusMinutes ? day : best))
    : null;

  const completionRateDelta =
    previousWeekCompletionRate !== undefined ? overallCompletionRate - previousWeekCompletionRate : undefined;

  const caveats: string[] = [];
  caveats.push('Planned time comes from planned blocks.');
  caveats.push('Actual time combines tracked Pomodoro focus sessions and tracked focus sessions.');
  if (totals.unlinkedActualMinutes > 0) {
    caveats.push('Some tracked focus time is not linked to a task or planned block.');
  }
  caveats.push('Untracked work is not included, and overlapping timers can overstate actual time.');

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
    caveats,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function rateLabel(rate: number): string {
  if (rate >= 90) return 'Excellent';
  if (rate >= 70) return 'Good';
  if (rate >= 50) return 'Fair';
  if (rate >= 30) return 'Low';
  return 'Behind';
}

export function efficiencyLabel(efficiency: number): string {
  if (efficiency >= 0.9) return 'On target';
  if (efficiency >= 0.7) return 'Good';
  if (efficiency >= 0.4) return 'Moderate';
  return 'Low';
}
