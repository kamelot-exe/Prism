import { get } from 'svelte/store';
import { listTasksRange, type Task } from '../api';
import { normalizeDate } from '../dates/safeDate';
import type { AutoScheduleOptions } from './autoScheduler';
import { eventsStore } from '../../stores/eventsStore';
import { settingsStore } from '../../stores/settings';

export function getDayRange(date: Date): { start: Date; end: Date } {
  const safeDate = normalizeDate(date);
  const start = new Date(safeDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(safeDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function loadAutoScheduleOptionsForDate(date: Date): Promise<AutoScheduleOptions> {
  const { start, end } = getDayRange(date);
  await eventsStore.loadRange(start, end);
  const settings = get(settingsStore);

  return {
    calendarEvents: eventsStore.eventsInRange(start, end),
    workStart: settings?.productivity?.workDayStart ?? '09:00',
    workEnd: settings?.productivity?.workDayEnd ?? '18:00',
    defaultDurationMinutes: settings?.productivity?.quickAddDuration ?? settings?.productivity?.pomodoroFocus ?? 30,
  };
}

export async function loadTasksThroughDate(date: Date): Promise<Task[]> {
  return listTasksRange(undefined, normalizeDate(date).toISOString());
}

export async function loadTasksForDateRange(start: Date, end: Date): Promise<Task[]> {
  return listTasksRange(normalizeDate(start).toISOString(), normalizeDate(end).toISOString());
}
