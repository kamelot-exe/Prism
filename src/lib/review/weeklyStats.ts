import type { Task } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';

export interface WeekRange {
  start: Date;
  end: Date;
}

export interface WeeklyStats {
  totalTasks: number;
  completedTasks: number;
  focusTasksCompleted: number;
  totalPlannedBlocks: number;
  completedPlannedBlocks: number;
  completedThisWeek: Task[];
  plannedButNotCompleted: Task[];
  neverScheduled: Task[];
}

function normalizedDateMs(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  // Zero-out time so comparisons are date-only
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function isDateInRange(date: Date | string | null | undefined, range: WeekRange): boolean {
  if (!date) return false;
  const normalized = normalizedDateMs(date);
  const rangeStart = normalizedDateMs(range.start);
  const rangeEnd = normalizedDateMs(range.end);
  if (normalized === null || rangeStart === null || rangeEnd === null) return false;
  return normalized >= rangeStart && normalized <= rangeEnd;
}

export function getWeekRange(date: Date = new Date()): WeekRange {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = 1, Sunday = 0
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

export function calculateWeeklyStats(
  tasks: Task[],
  plannedBlocks: PlannedEvent[],
  weekRange: WeekRange
): WeeklyStats {
  const weekTasks = tasks.filter((task) => isDateInRange(task.date, weekRange));
  const totalTasks = weekTasks.length;
  const completedTasks = weekTasks.filter((t) => t.done).length;
  const focusTasksCompleted = weekTasks.filter((t) => t.done && t.isFocus).length;
  
  const weekBlocks = plannedBlocks.filter((block) => {
    const blockDate = normalizedDateMs(block.start);
    const rangeStart = normalizedDateMs(weekRange.start);
    const rangeEnd = normalizedDateMs(weekRange.end);
    if (blockDate === null || rangeStart === null || rangeEnd === null) return false;
    return blockDate >= rangeStart && blockDate <= rangeEnd;
  });
  
  const totalPlannedBlocks = weekBlocks.length;
  const completedPlannedBlocks = weekBlocks.filter((b) => b.completed).length;
  
  const completedThisWeek = weekTasks.filter((t) => t.done);
  
  const taskIdsWithBlocks = new Set(
    weekBlocks.filter((b) => b.taskId).map((b) => b.taskId as number)
  );
  
  const plannedButNotCompleted = weekTasks.filter((task) => {
    if (!task.id) return false;
    const hasBlock = taskIdsWithBlocks.has(task.id);
    return hasBlock && !task.done;
  });
  
  const neverScheduled = weekTasks.filter((task) => {
    if (!task.id) return true;
    return !taskIdsWithBlocks.has(task.id) && !task.done;
  });
  
  return {
    totalTasks,
    completedTasks,
    focusTasksCompleted,
    totalPlannedBlocks,
    completedPlannedBlocks,
    completedThisWeek,
    plannedButNotCompleted,
    neverScheduled,
  };
}

