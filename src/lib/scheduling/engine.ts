import type { Task, Event, PomodoroSession } from '../api';
import { normalizeDate } from '../dates/safeDate';

export interface ScheduleBlock {
  id: string;
  type: "task" | "break" | "buffer";
  start: Date;
  end: Date;
  taskId?: number | null;
  label: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export interface SchedulingContext {
  date: Date;                         // day being scheduled
  tasks: Task[];                      // all tasks relevant to that day
  events: Event[];                    // all events on that date
  sessions: PomodoroSession[];        // pomodoro sessions for that date (optional use)
  workStart: string;                  // "HH:MM"
  workEnd: string;                    // "HH:MM"
  focusMinutes: number;               // from settings.productivity.pomodoroFocus
  breakMinutes: number;               // from settings.productivity.pomodoroBreak
}

interface TimeInterval {
  start: Date;
  end: Date;
}

/**
 * Parse "HH:MM" string to hours and minutes
 */
function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour: hour || 9, minute: minute || 0 };
}

/**
 * Create a Date for a specific time on the target date
 */
function timeOnDate(date: Date, hour: number, minute: number): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
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
 * Subtract busy intervals from working window to get free intervals
 */
function computeFreeIntervals(
  workStart: Date,
  workEnd: Date,
  busyIntervals: TimeInterval[]
): TimeInterval[] {
  const free: TimeInterval[] = [];
  let currentStart = workStart;
  
  for (const busy of busyIntervals) {
    if (currentStart < busy.start) {
      // There's free time before this busy interval
      free.push({
        start: currentStart,
        end: new Date(Math.min(busy.start.getTime(), workEnd.getTime())),
      });
    }
    // Move currentStart to after this busy interval
    currentStart = new Date(Math.max(currentStart.getTime(), busy.end.getTime()));
    if (currentStart >= workEnd) break;
  }
  
  // Add remaining free time after last busy interval
  if (currentStart < workEnd) {
    free.push({
      start: currentStart,
      end: workEnd,
    });
  }
  
  return free;
}

/**
 * Get priority order number (lower = higher priority)
 */
function getPriorityOrder(priority?: string): number {
  switch (priority) {
    case "urgent": return 0;
    case "high": return 1;
    case "normal": return 2;
    case "low": return 3;
    default: return 2; // normal
  }
}

/**
 * Check if task is overdue
 */
function isTaskOverdue(task: Task, targetDate: Date): boolean {
  if (!task.date || task.done) return false;
  const taskDate = new Date(task.date);
  taskDate.setHours(0, 0, 0, 0);
  const target = normalizeDate(targetDate);
  return taskDate < target;
}

/**
 * Sort tasks by priority, then overdue status, then date, then id
 */
function sortTasksForScheduling(tasks: Task[], targetDate: Date): Task[] {
  return [...tasks].sort((a, b) => {
    // First: priority
    const priorityA = getPriorityOrder(a.priority);
    const priorityB = getPriorityOrder(b.priority);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Second: overdue first
    const overdueA = isTaskOverdue(a, targetDate) ? 0 : 1;
    const overdueB = isTaskOverdue(b, targetDate) ? 0 : 1;
    if (overdueA !== overdueB) {
      return overdueA - overdueB;
    }
    
    // Third: earlier date first
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    
    // Fourth: id as tie-breaker
    return (a.id || 0) - (b.id || 0);
  });
}

/**
 * Get effective duration for a task
 */
function getEffectiveDuration(task: Task, defaultFocusMinutes: number): number {
  if (task.estimatedMinutes && task.estimatedMinutes > 0) {
    return task.estimatedMinutes;
  }
  return defaultFocusMinutes;
}

/**
 * Generate schedule blocks for a task within a free interval
 */
function scheduleTaskInInterval(
  task: Task,
  interval: TimeInterval,
  effectiveDuration: number,
  focusMinutes: number,
  breakMinutes: number,
  blocks: ScheduleBlock[],
  date: Date
): { blocks: ScheduleBlock[]; remainingDuration: number; nextStart: Date } {
  const newBlocks: ScheduleBlock[] = [];
  let remainingDuration = effectiveDuration;
  let currentStart = interval.start;
  let blockIndex = blocks.length;
  
  while (remainingDuration > 0 && currentStart < interval.end) {
    const availableMinutes = Math.floor((interval.end.getTime() - currentStart.getTime()) / (1000 * 60));
    
    if (availableMinutes <= 0) break;
    
    // Create a focus block (up to focusMinutes or remaining duration, whichever is smaller)
    const blockDuration = Math.min(focusMinutes, remainingDuration, availableMinutes);
    const blockEnd = new Date(currentStart.getTime() + blockDuration * 60 * 1000);
    
    // Don't schedule past interval end
    if (blockEnd > interval.end) break;
    
    const blockId = `sched-${date.toISOString().split('T')[0]}-${blockIndex++}`;
    newBlocks.push({
      id: blockId,
      type: "task",
      start: new Date(currentStart),
      end: blockEnd,
      taskId: task.id || null,
      label: task.title,
      priority: task.priority || "normal",
    });
    
    remainingDuration -= blockDuration;
    currentStart = blockEnd;
    
    // Add break if there's more work to do and time available
    if (remainingDuration > 0 && currentStart < interval.end) {
      const breakAvailable = Math.floor((interval.end.getTime() - currentStart.getTime()) / (1000 * 60));
      if (breakAvailable >= breakMinutes) {
        const breakEnd = new Date(currentStart.getTime() + breakMinutes * 60 * 1000);
        const breakId = `sched-${date.toISOString().split('T')[0]}-${blockIndex++}`;
        newBlocks.push({
          id: breakId,
          type: "break",
          start: new Date(currentStart),
          end: breakEnd,
          label: "Break",
        });
        currentStart = breakEnd;
      }
    }
  }
  
  return {
    blocks: newBlocks,
    remainingDuration,
    nextStart: currentStart,
  };
}

/**
 * Add buffer before events if needed
 */
function addBuffersBeforeEvents(
  blocks: ScheduleBlock[],
  events: Event[],
  date: Date
): ScheduleBlock[] {
  const result: ScheduleBlock[] = [];
  const eventStarts = events
    .map(e => new Date(e.start_time))
    .filter(d => normalizeDate(d).getTime() === normalizeDate(date).getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  
  for (const block of blocks) {
    if (block.type !== "task") {
      result.push(block);
      continue;
    }
    
    // Check if any event starts within 10-20 minutes after this block
    const blockEnd = block.end.getTime();
    let needsBuffer = false;
    let bufferEnd = block.end;
    
    for (const eventStart of eventStarts) {
      const minutesUntilEvent = (eventStart.getTime() - blockEnd) / (1000 * 60);
      if (minutesUntilEvent >= 10 && minutesUntilEvent < 20) {
        // Shorten the block to end 5-10 minutes before event
        const bufferMinutes = Math.min(10, minutesUntilEvent - 5);
        bufferEnd = new Date(eventStart.getTime() - bufferMinutes * 60 * 1000);
        needsBuffer = true;
        break;
      }
    }
    
    if (needsBuffer && bufferEnd < block.end) {
      // Shorten the task block
      const shortenedBlock = { ...block, end: bufferEnd };
      result.push(shortenedBlock);
      
      // Add buffer block
      const bufferId = `sched-${date.toISOString().split('T')[0]}-buffer-${result.length}`;
      result.push({
        id: bufferId,
        type: "buffer",
        start: bufferEnd,
        end: new Date(Math.min(bufferEnd.getTime() + 5 * 60 * 1000, block.end.getTime())),
        label: "Transition",
      });
    } else {
      result.push(block);
    }
  }
  
  return result;
}

/**
 * Main scheduling function
 */
export function generateSchedule(ctx: SchedulingContext): ScheduleBlock[] {
  const { date, tasks, events, workStart, workEnd, focusMinutes, breakMinutes } = ctx;
  
  // Normalize date to local day
  const targetDate = normalizeDate(date);
  
  // Parse working hours
  const { hour: startHour, minute: startMinute } = parseTime(workStart);
  const { hour: endHour, minute: endMinute } = parseTime(workEnd);
  
  const workStartTime = timeOnDate(targetDate, startHour, startMinute);
  const workEndTime = timeOnDate(targetDate, endHour, endMinute);
  
  // Build busy intervals from events
  const busyIntervals: TimeInterval[] = events
    .filter(e => {
      const eventStart = new Date(e.start_time);
      const eventDate = normalizeDate(eventStart);
      return eventDate.getTime() === targetDate.getTime() && !e.all_day;
    })
    .map(e => ({
      start: new Date(e.start_time),
      end: new Date(e.end_time),
    }));
  
  const mergedBusy = mergeIntervals(busyIntervals);
  
  // Compute free intervals
  const freeIntervals = computeFreeIntervals(workStartTime, workEndTime, mergedBusy);
  
  // Prepare tasks: filter and sort
  const relevantTasks = tasks.filter(t => {
    if (t.done) return false;
    if (!t.date) return false;
    const taskDate = normalizeDate(new Date(t.date));
    const target = normalizeDate(targetDate);
    // Include tasks for this date or overdue tasks
    return taskDate.getTime() === target.getTime() || isTaskOverdue(t, targetDate);
  });
  
  const sortedTasks = sortTasksForScheduling(relevantTasks, targetDate);
  
  // Greedily fill free intervals
  const allBlocks: ScheduleBlock[] = [];
  let taskIndex = 0;
  
  for (const freeInterval of freeIntervals) {
    let currentStart = freeInterval.start;
    
    while (taskIndex < sortedTasks.length && currentStart < freeInterval.end) {
      const task = sortedTasks[taskIndex];
      const effectiveDuration = getEffectiveDuration(task, focusMinutes);
      
      const result = scheduleTaskInInterval(
        task,
        { start: currentStart, end: freeInterval.end },
        effectiveDuration,
        focusMinutes,
        breakMinutes,
        allBlocks,
        targetDate
      );
      
      allBlocks.push(...result.blocks);
      currentStart = result.nextStart;
      
      // If task is fully scheduled, move to next task
      if (result.remainingDuration <= 0) {
        taskIndex++;
      } else {
        // Task needs more time but no more space in this interval
        // Move to next interval (task will be picked up in next free interval if available)
        break;
      }
    }
  }
  
  // Sort all blocks by start time
  allBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
  
  // Add buffers before events
  const finalBlocks = addBuffersBeforeEvents(allBlocks, events, targetDate);
  
  return finalBlocks;
}

