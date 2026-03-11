import type { Event, Task } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';
import { normalizeDate } from '../dates/safeDate';

export interface TimeInterval {
  start: Date;
  end: Date;
}

export interface WorkWindow {
  start: Date;
  end: Date;
}

export const DEFAULT_TASK_DURATION_MINUTES = 30;
export const MIN_TASK_DURATION_MINUTES = 15;
export const MAX_TASK_DURATION_MINUTES = 8 * 60;

function parseTimePart(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseWorkWindow(date: Date, workStart: string, workEnd: string): WorkWindow {
  const targetDate = normalizeDate(date);
  const [startHourPart, startMinutePart] = workStart.split(':');
  const [endHourPart, endMinutePart] = workEnd.split(':');

  const start = new Date(targetDate);
  start.setHours(parseTimePart(startHourPart, 9), parseTimePart(startMinutePart, 0), 0, 0);

  const end = new Date(targetDate);
  end.setHours(parseTimePart(endHourPart, 18), parseTimePart(endMinutePart, 0), 0, 0);

  if (end.getTime() <= start.getTime()) {
    const fallbackEnd = new Date(targetDate);
    fallbackEnd.setHours(18, 0, 0, 0);
    return {
      start,
      end: fallbackEnd.getTime() > start.getTime() ? fallbackEnd : new Date(start.getTime() + 60 * 60 * 1000),
    };
  }

  return { start, end };
}

export function sanitizeTaskDuration(
  task: Pick<Task, 'estimatedMinutes'>,
  fallbackMinutes: number,
  maxMinutes: number = MAX_TASK_DURATION_MINUTES
): number {
  const safeFallback = Math.max(MIN_TASK_DURATION_MINUTES, Math.floor(fallbackMinutes || DEFAULT_TASK_DURATION_MINUTES));
  const safeMax = Math.max(safeFallback, Math.floor(maxMinutes || MAX_TASK_DURATION_MINUTES));
  const rawValue = task.estimatedMinutes;

  if (rawValue == null || !Number.isFinite(rawValue)) {
    return Math.min(safeFallback, safeMax);
  }

  const rounded = Math.floor(rawValue);
  if (rounded <= 0) {
    return Math.min(safeFallback, safeMax);
  }

  return Math.max(MIN_TASK_DURATION_MINUTES, Math.min(rounded, safeMax));
}

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeInterval[] = [{ start: new Date(sorted[0].start), end: new Date(sorted[0].end) }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push({ start: new Date(current.start), end: new Date(current.end) });
    }
  }

  return merged;
}

function clipInterval(interval: TimeInterval, workWindow: WorkWindow): TimeInterval | null {
  const start = new Date(Math.max(interval.start.getTime(), workWindow.start.getTime()));
  const end = new Date(Math.min(interval.end.getTime(), workWindow.end.getTime()));

  if (end.getTime() <= start.getTime()) {
    return null;
  }

  return { start, end };
}

function eventToInterval(event: Event): TimeInterval | null {
  if (event.all_day) {
    return null;
  }

  const start = new Date(event.start_time);
  const end = new Date(event.end_time);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return null;
  }

  return { start, end };
}

function plannedBlockToInterval(block: PlannedEvent): TimeInterval | null {
  const start = new Date(block.start);
  const end = new Date(block.end);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return null;
  }

  return { start, end };
}

export function buildBusyIntervals(
  workWindow: WorkWindow,
  events: Event[],
  plannedBlocks: PlannedEvent[]
): TimeInterval[] {
  const intervals = [
    ...events.map(eventToInterval),
    ...plannedBlocks.map(plannedBlockToInterval),
  ]
    .filter((interval): interval is TimeInterval => interval !== null)
    .map((interval) => clipInterval(interval, workWindow))
    .filter((interval): interval is TimeInterval => interval !== null);

  return mergeIntervals(intervals);
}

export function computeFreeIntervals(workWindow: WorkWindow, busyIntervals: TimeInterval[]): TimeInterval[] {
  const free: TimeInterval[] = [];
  let currentStart = new Date(workWindow.start);

  for (const busy of busyIntervals) {
    if (currentStart < busy.start) {
      free.push({
        start: new Date(currentStart),
        end: new Date(Math.min(busy.start.getTime(), workWindow.end.getTime())),
      });
    }

    currentStart = new Date(Math.max(currentStart.getTime(), busy.end.getTime()));
    if (currentStart >= workWindow.end) {
      break;
    }
  }

  if (currentStart < workWindow.end) {
    free.push({
      start: currentStart,
      end: new Date(workWindow.end),
    });
  }

  return free;
}
