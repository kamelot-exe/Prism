import type { Task, Event, PomodoroSession } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';
import { normalizeDate } from '../dates/safeDate';
import {
  buildBusyIntervals,
  computeFreeIntervals,
  parseWorkWindow,
  sanitizeTaskDuration,
} from '../scheduler/schedulerRules';

export interface ScheduleBlock {
  id: string;
  type: 'task' | 'break' | 'buffer';
  start: Date;
  end: Date;
  taskId?: number | null;
  label: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface SchedulingContext {
  date: Date;
  tasks: Task[];
  events: Event[];
  plannedBlocks: PlannedEvent[];
  sessions: PomodoroSession[];
  workStart: string;
  workEnd: string;
  focusMinutes: number;
  breakMinutes: number;
}

interface TimeInterval {
  start: Date;
  end: Date;
}

function getPriorityOrder(priority?: string): number {
  switch (priority) {
    case 'urgent': return 0;
    case 'high': return 1;
    case 'normal': return 2;
    case 'low': return 3;
    default: return 2;
  }
}

function isTaskOverdue(task: Task, targetDate: Date): boolean {
  if (!task.date || task.done) return false;
  const taskDate = new Date(task.date);
  taskDate.setHours(0, 0, 0, 0);
  const target = normalizeDate(targetDate);
  return taskDate < target;
}

function sortTasksForScheduling(tasks: Task[], targetDate: Date): Task[] {
  return [...tasks].sort((a, b) => {
    const priorityA = getPriorityOrder(a.priority);
    const priorityB = getPriorityOrder(b.priority);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const overdueA = isTaskOverdue(a, targetDate) ? 0 : 1;
    const overdueB = isTaskOverdue(b, targetDate) ? 0 : 1;
    if (overdueA !== overdueB) {
      return overdueA - overdueB;
    }

    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    if (dateA !== dateB) {
      return dateA - dateB;
    }

    return (a.id || 0) - (b.id || 0);
  });
}

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

    const blockDuration = Math.min(Math.max(5, focusMinutes), remainingDuration, availableMinutes);
    const blockEnd = new Date(currentStart.getTime() + blockDuration * 60 * 1000);

    if (blockEnd > interval.end) break;

    const blockId = `sched-${date.toISOString().split('T')[0]}-${blockIndex++}`;
    newBlocks.push({
      id: blockId,
      type: 'task',
      start: new Date(currentStart),
      end: blockEnd,
      taskId: task.id || null,
      label: task.title,
      priority: task.priority || 'normal',
    });

    remainingDuration -= blockDuration;
    currentStart = blockEnd;

    if (remainingDuration > 0 && currentStart < interval.end) {
      const breakAvailable = Math.floor((interval.end.getTime() - currentStart.getTime()) / (1000 * 60));
      if (breakAvailable >= breakMinutes) {
        const breakEnd = new Date(currentStart.getTime() + breakMinutes * 60 * 1000);
        const breakId = `sched-${date.toISOString().split('T')[0]}-${blockIndex++}`;
        newBlocks.push({
          id: breakId,
          type: 'break',
          start: new Date(currentStart),
          end: breakEnd,
          label: 'Break',
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

function addBuffersBeforeEvents(
  blocks: ScheduleBlock[],
  events: Event[]
): ScheduleBlock[] {
  const result: ScheduleBlock[] = [];
  const eventStarts = events
    .filter((event) => !event.all_day)
    .map((event) => new Date(event.start_time))
    .sort((a, b) => a.getTime() - b.getTime());

  for (const block of blocks) {
    if (block.type !== 'task') {
      result.push(block);
      continue;
    }

    const blockEnd = block.end.getTime();
    let needsBuffer = false;
    let bufferEnd = block.end;

    for (const eventStart of eventStarts) {
      const minutesUntilEvent = (eventStart.getTime() - blockEnd) / (1000 * 60);
      if (minutesUntilEvent >= 10 && minutesUntilEvent < 20) {
        const bufferMinutes = Math.min(10, minutesUntilEvent - 5);
        bufferEnd = new Date(eventStart.getTime() - bufferMinutes * 60 * 1000);
        needsBuffer = true;
        break;
      }
    }

    if (needsBuffer && bufferEnd < block.end) {
      result.push({ ...block, end: bufferEnd });
      result.push({
        id: `sched-${block.start.toISOString().split('T')[0]}-buffer-${result.length}`,
        type: 'buffer',
        start: bufferEnd,
        end: new Date(Math.min(bufferEnd.getTime() + 5 * 60 * 1000, block.end.getTime())),
        label: 'Transition',
      });
    } else {
      result.push(block);
    }
  }

  return result;
}

export function generateSchedule(ctx: SchedulingContext): ScheduleBlock[] {
  const { date, tasks, events, plannedBlocks, workStart, workEnd, focusMinutes, breakMinutes } = ctx;
  const targetDate = normalizeDate(date);
  const workWindow = parseWorkWindow(targetDate, workStart, workEnd);
  const busyIntervals = buildBusyIntervals(workWindow, events, plannedBlocks);
  const freeIntervals = computeFreeIntervals(workWindow, busyIntervals);

  const relevantTasks = tasks.filter((task) => {
    if (task.done || !task.date) return false;
    const taskDate = normalizeDate(new Date(task.date));
    return taskDate.getTime() === targetDate.getTime() || isTaskOverdue(task, targetDate);
  });

  const sortedTasks = sortTasksForScheduling(relevantTasks, targetDate);
  const allBlocks: ScheduleBlock[] = [];
  let taskIndex = 0;
  const maxTaskMinutes = Math.floor((workWindow.end.getTime() - workWindow.start.getTime()) / (1000 * 60));

  for (const freeInterval of freeIntervals) {
    let currentStart = freeInterval.start;

    while (taskIndex < sortedTasks.length && currentStart < freeInterval.end) {
      const task = sortedTasks[taskIndex];
      const effectiveDuration = sanitizeTaskDuration(task, focusMinutes, maxTaskMinutes);

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

      if (result.remainingDuration <= 0) {
        taskIndex++;
      } else {
        break;
      }
    }
  }

  allBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
  return addBuffersBeforeEvents(allBlocks, events);
}
