import type { Task, Event } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';
import { normalizeDate } from '../dates/safeDate';
import { overlaps } from './conflicts';

export interface TimeInterval {
  start: Date;
  end: Date;
}

/**
 * Get start of day (00:00:00)
 */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(0, 0, 0);
  return d;
}

/**
 * Get end of day (23:59:59)
 */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Normalize and sort intervals by start time
 */
function normalizeIntervals(blocks: PlannedEvent[]): TimeInterval[] {
  return blocks
    .map((block) => ({
      start: new Date(block.start),
      end: new Date(block.end),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Merge overlapping intervals
 */
function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeInterval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping or adjacent - merge
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      // Non-overlapping - add new interval
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Compute free intervals between busy intervals within a day
 */
function computeFreeIntervals(
  dayStart: Date,
  dayEnd: Date,
  busyIntervals: TimeInterval[]
): TimeInterval[] {
  const free: TimeInterval[] = [];
  let currentStart = dayStart;

  for (const busy of busyIntervals) {
    if (currentStart < busy.start) {
      // There's free time before this busy interval
      free.push({
        start: new Date(currentStart),
        end: new Date(Math.min(busy.start.getTime(), dayEnd.getTime())),
      });
    }
    // Move currentStart to after this busy interval
    currentStart = new Date(Math.max(currentStart.getTime(), busy.end.getTime()));
    if (currentStart >= dayEnd) break;
  }

  // Add remaining free time after last busy interval
  if (currentStart < dayEnd) {
    free.push({
      start: new Date(currentStart),
      end: new Date(dayEnd),
    });
  }

  return free;
}

/**
 * Find first free interval that can fit the task duration
 */
function findFittingInterval(
  freeIntervals: TimeInterval[],
  durationMinutes: number
): TimeInterval | null {
  for (const interval of freeIntervals) {
    const intervalDurationMs = interval.end.getTime() - interval.start.getTime();
    const intervalDurationMinutes = intervalDurationMs / (1000 * 60);

    if (intervalDurationMinutes >= durationMinutes) {
      return interval;
    }
  }

  return null;
}

/**
 * Get task duration in minutes
 */
function getTaskDuration(task: Task): number {
  if (task.estimatedMinutes && task.estimatedMinutes > 0) {
    return task.estimatedMinutes;
  }
  return 30; // Default 30 minutes
}

/**
 * Get task color based on priority
 */
function getTaskColor(task: Task): string {
  switch (task.priority) {
    case 'urgent':
      return '#ef4444';
    case 'high':
      return '#fb923c';
    case 'normal':
      return 'var(--accent)';
    case 'low':
      return '#4ade80';
    default:
      return 'var(--accent)';
  }
}

/**
 * Auto-schedule a task into the first available free slot
 * 
 * @param task - Task to schedule
 * @param date - Target date for scheduling
 * @param existingBlocks - Existing planned events for the day
 * @param calendarEvents - Optional calendar events to consider as soft busy
 * @returns Omit<PlannedEvent, 'id'> if scheduled, null if no free slot available
 */
export function autoScheduleTask(
  task: Task,
  date: Date,
  existingBlocks: PlannedEvent[],
  calendarEvents?: Event[]
): Omit<PlannedEvent, 'id'> | null {
  if (task.done) {
    return null;
  }

  const targetDate = normalizeDate(date);
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  // Step 1: Normalize existing blocks
  const normalizedBlocks = normalizeIntervals(existingBlocks);
  const mergedBlocks = mergeIntervals(normalizedBlocks);

  // Step 2: Compute free intervals
  let freeIntervals = computeFreeIntervals(dayStart, dayEnd, mergedBlocks);

  // Step 2.5: If calendar events provided, prefer intervals without event overlap
  if (calendarEvents && calendarEvents.length > 0) {
    const intervalsWithoutEvents = freeIntervals.filter((interval) => {
      return !calendarEvents.some((event) => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        return overlaps(interval.start, interval.end, eventStart, eventEnd);
      });
    });
    
    // Use intervals without events if available, otherwise fall back to all intervals
    if (intervalsWithoutEvents.length > 0) {
      freeIntervals = intervalsWithoutEvents;
    }
  }

  // Step 3: Get task duration
  const durationMinutes = getTaskDuration(task);

  // Step 4: Find first fitting interval
  const fittingInterval = findFittingInterval(freeIntervals, durationMinutes);

  if (!fittingInterval) {
    return null; // No free slot available
  }

  // Step 5: Create PlannedEvent
  const startTime = new Date(fittingInterval.start);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);

  // Ensure end time doesn't exceed interval end
  if (endTime > fittingInterval.end) {
    endTime.setTime(fittingInterval.end.getTime());
  }

  const plannedEvent: Omit<PlannedEvent, 'id'> = {
    taskId: task.id,
    title: task.title,
    start: startTime,
    end: endTime,
    color: getTaskColor(task),
  };

  return plannedEvent;
}

/**
 * Get task duration in minutes for sorting
 */
function getTaskDurationForSort(task: Task): number {
  if (task.estimatedMinutes && task.estimatedMinutes > 0) {
    return task.estimatedMinutes;
  }
  return 30; // Default 30 minutes
}

/**
 * Check if a task already has a planned block
 */
function hasBlockForTaskId(taskId: number | undefined, existingBlocks: PlannedEvent[]): boolean {
  if (!taskId) return false;
  return existingBlocks.some((block) => block.taskId === taskId);
}

/**
 * Batch auto-schedule multiple tasks for a date
 * 
 * @param tasks - Tasks to schedule
 * @param date - Target date for scheduling
 * @param existingBlocks - Existing planned events for the day
 * @returns Object with scheduled blocks and unscheduled tasks
 */
export function autoScheduleTasksForDate(
  tasks: Task[],
  date: Date,
  existingBlocks: PlannedEvent[]
): {
  scheduled: Omit<PlannedEvent, 'id'>[];
  unscheduled: Task[];
} {
  // Filter to non-completed tasks
  const pendingTasks = tasks.filter((task) => !task.done);
  
  // Filter out tasks that already have blocks
  const tasksToSchedule = pendingTasks.filter(
    (task) => !hasBlockForTaskId(task.id, existingBlocks)
  );
  
  // Sort by priority first, then by duration descending
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const sortedTasks = [...tasksToSchedule].sort((a, b) => {
    const priorityA = priorityOrder[a.priority ?? 'normal'] ?? 2;
    const priorityB = priorityOrder[b.priority ?? 'normal'] ?? 2;
    
    // First sort by priority
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Then sort by duration descending (longer tasks first)
    const durationA = getTaskDurationForSort(a);
    const durationB = getTaskDurationForSort(b);
    return durationB - durationA;
  });
  
  const scheduled: Omit<PlannedEvent, 'id'>[] = [];
  const unscheduled: Task[] = [];
  
  // Maintain growing list of scheduled blocks
  let scheduledBlocks: PlannedEvent[] = [...existingBlocks];
  
  // Schedule each task sequentially
  for (const task of sortedTasks) {
    // Compute current existing blocks (base + newly scheduled)
    const currentBlocks = scheduledBlocks.map((block) => ({
      ...block,
      start: new Date(block.start),
      end: new Date(block.end),
    }));
    
    // Try to schedule the task
    const plannedEvent = autoScheduleTask(task, date, currentBlocks);
    
    if (plannedEvent) {
      scheduled.push(plannedEvent);
      // Add to scheduledBlocks for next iteration (with temporary id)
      scheduledBlocks.push({
        ...plannedEvent,
        id: `temp-${Date.now()}-${Math.random()}`,
      });
    } else {
      unscheduled.push(task);
    }
  }
  
  return { scheduled, unscheduled };
}

