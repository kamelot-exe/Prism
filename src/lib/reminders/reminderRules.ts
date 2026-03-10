import type { Task, Event } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';
import { normalizeDate } from '../dates/safeDate';

export interface Reminder {
  at: Date;
  priority: number;
  source: 'task' | 'event' | 'block';
  id: number | string;
}

export function getTaskReminder(task: Task, date: Date): Reminder | null {
  if (!task.id || task.done) {
    return null;
  }

  const taskDate = task.date ? normalizeDate(new Date(task.date)) : null;
  if (!taskDate) {
    return null;
  }

  const targetDate = normalizeDate(date);
  if (taskDate.getTime() !== targetDate.getTime()) {
    return null;
  }

  let minutesBefore = 60;
  
  if (task.priority === 'urgent') {
    minutesBefore = 30;
  } else if (task.priority === 'high') {
    minutesBefore = 60;
  } else if (task.isFocus) {
    minutesBefore = 10;
  }

  const reminderAt = new Date(targetDate);
  reminderAt.setHours(9, 0, 0, 0);
  reminderAt.setMinutes(reminderAt.getMinutes() - minutesBefore);

  if (reminderAt.getTime() <= Date.now()) {
    return null;
  }

  const priority = task.priority === 'urgent' ? 0 : task.priority === 'high' ? 1 : task.isFocus ? 2 : 3;

  return {
    at: reminderAt,
    priority,
    source: 'task',
    id: task.id,
  };
}

export function getEventReminder(event: Event): Reminder | null {
  if (!event.id) {
    return null;
  }

  const start = new Date(event.start_time);
  const reminderMinutes = event.reminder_minutes ?? 15;
  const reminderAt = new Date(start.getTime() - reminderMinutes * 60 * 1000);

  if (reminderAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    at: reminderAt,
    priority: 1,
    source: 'event',
    id: event.id,
  };
}

export function getPlannedBlockReminder(block: PlannedEvent, task?: Task): Reminder | null {
  if (!block.id || block.completed) {
    return null;
  }

  const start = new Date(block.start);
  const isFocus = task?.isFocus ?? false;
  const minutesBefore = isFocus ? 10 : 5;
  const reminderAt = new Date(start.getTime() - minutesBefore * 60 * 1000);

  if (reminderAt.getTime() <= Date.now()) {
    return null;
  }

  const priority = isFocus ? 1 : 2;

  return {
    at: reminderAt,
    priority,
    source: 'block',
    id: block.id,
  };
}

