import type { Task, Event } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';
import {
  DEFAULT_TASK_DURATION_MINUTES,
  type TimeInterval,
  buildBusyIntervals,
  computeFreeIntervals,
  parseWorkWindow,
  sanitizeTaskDuration,
} from './schedulerRules';

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

function hasBlockForTaskId(taskId: number | undefined, existingBlocks: PlannedEvent[]): boolean {
  if (!taskId) return false;
  return existingBlocks.some((block) => block.taskId === taskId);
}

export interface AutoScheduleOptions {
  calendarEvents?: Event[];
  workStart?: string;
  workEnd?: string;
  defaultDurationMinutes?: number;
}

export function autoScheduleTask(
  task: Task,
  date: Date,
  existingBlocks: PlannedEvent[],
  options: AutoScheduleOptions = {}
): Omit<PlannedEvent, 'id'> | null {
  if (task.done) {
    return null;
  }

  const workWindow = parseWorkWindow(date, options.workStart ?? '09:00', options.workEnd ?? '18:00');
  const busyIntervals = buildBusyIntervals(workWindow, options.calendarEvents ?? [], existingBlocks);
  const freeIntervals = computeFreeIntervals(workWindow, busyIntervals);
  const durationMinutes = sanitizeTaskDuration(
    task,
    options.defaultDurationMinutes ?? DEFAULT_TASK_DURATION_MINUTES,
    Math.floor((workWindow.end.getTime() - workWindow.start.getTime()) / (1000 * 60))
  );
  const fittingInterval = findFittingInterval(freeIntervals, durationMinutes);

  if (!fittingInterval) {
    return null;
  }

  const startTime = new Date(fittingInterval.start);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);

  if (endTime > fittingInterval.end) {
    endTime.setTime(fittingInterval.end.getTime());
  }

  return {
    taskId: task.id,
    title: task.title,
    start: startTime,
    end: endTime,
    color: getTaskColor(task),
  };
}

function getTaskDurationForSort(task: Task, fallbackMinutes: number): number {
  return sanitizeTaskDuration(task, fallbackMinutes);
}

export function autoScheduleTasksForDate(
  tasks: Task[],
  date: Date,
  existingBlocks: PlannedEvent[],
  options: AutoScheduleOptions = {}
): {
  scheduled: Omit<PlannedEvent, 'id'>[];
  unscheduled: Task[];
} {
  const pendingTasks = tasks.filter((task) => !task.done);
  const tasksToSchedule = pendingTasks.filter(
    (task) => !hasBlockForTaskId(task.id, existingBlocks)
  );

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const defaultDuration = options.defaultDurationMinutes ?? DEFAULT_TASK_DURATION_MINUTES;

  const sortedTasks = [...tasksToSchedule].sort((a, b) => {
    const priorityA = priorityOrder[a.priority ?? 'normal'] ?? 2;
    const priorityB = priorityOrder[b.priority ?? 'normal'] ?? 2;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const durationA = getTaskDurationForSort(a, defaultDuration);
    const durationB = getTaskDurationForSort(b, defaultDuration);
    return durationB - durationA;
  });

  const scheduled: Omit<PlannedEvent, 'id'>[] = [];
  const unscheduled: Task[] = [];
  let scheduledBlocks: PlannedEvent[] = [...existingBlocks];

  for (const task of sortedTasks) {
    const currentBlocks = scheduledBlocks.map((block) => ({
      ...block,
      start: new Date(block.start),
      end: new Date(block.end),
    }));

    const plannedEvent = autoScheduleTask(task, date, currentBlocks, options);

    if (plannedEvent) {
      scheduled.push(plannedEvent);
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
