import type { Reminder } from './reminderRules';
import { notify } from '../notifications/notificationAdapter';
import type { Task } from '../api';
import type { Event } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';
import { getTaskReminder } from './reminderRules';
import { getEventReminder } from './reminderRules';
import { getPlannedBlockReminder } from './reminderRules';
import { normalizeDate } from '../dates/safeDate';

type TimerId = ReturnType<typeof setTimeout>;

interface ScheduledReminder {
  timerId: TimerId;
  reminder: Reminder;
}

const scheduledReminders = new Map<string, ScheduledReminder>();
const NEXT_24H_MS = 24 * 60 * 60 * 1000;

function getReminderKey(reminder: Reminder): string {
  return `${reminder.source}-${reminder.id}`;
}

function cancelReminder(key: string): void {
  const scheduled = scheduledReminders.get(key);
  if (scheduled) {
    clearTimeout(scheduled.timerId);
    scheduledReminders.delete(key);
  }
}

function scheduleReminder(reminder: Reminder): void {
  const key = getReminderKey(reminder);
  cancelReminder(key);

  const now = Date.now();
  const fireAt = reminder.at.getTime();
  const delay = fireAt - now;

  if (delay <= 0 || delay > NEXT_24H_MS) {
    return;
  }

  const timerId = setTimeout(async () => {
    scheduledReminders.delete(key);
    await fireReminder(reminder);
  }, delay);

  scheduledReminders.set(key, { timerId, reminder });
}

async function fireReminder(reminder: Reminder): Promise<void> {
  let title = 'Reminder';
  let body = '';

  if (reminder.source === 'task') {
    title = 'Task Reminder';
    body = `Task reminder`;
  } else if (reminder.source === 'event') {
    title = 'Event Reminder';
    body = `Event reminder`;
  } else if (reminder.source === 'block') {
    title = 'Scheduled Block Reminder';
    body = `Scheduled block reminder`;
  }

  await notify({
    title,
    body,
    data: {
      source: reminder.source,
      id: reminder.id,
    },
  });
}

function deduplicateReminders(reminders: Reminder[]): Reminder[] {
  const seen = new Map<string, Reminder>();

  for (const reminder of reminders) {
    const key = getReminderKey(reminder);
    const existing = seen.get(key);

    if (!existing || reminder.priority < existing.priority) {
      seen.set(key, reminder);
    }
  }

  return Array.from(seen.values());
}

export function collectUpcomingReminders(
  tasks: Task[],
  events: Event[],
  blocks: PlannedEvent[],
  tasksMap: Map<number, Task>
): Reminder[] {
  const reminders: Reminder[] = [];
  const now = Date.now();
  const next24h = now + NEXT_24H_MS;

  const today = normalizeDate(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const task of tasks) {
    if (task.done || !task.id) continue;

    const todayReminder = getTaskReminder(task, today);
    if (todayReminder && todayReminder.at.getTime() <= next24h) {
      reminders.push(todayReminder);
    }

    const tomorrowReminder = getTaskReminder(task, tomorrow);
    if (tomorrowReminder && tomorrowReminder.at.getTime() <= next24h) {
      reminders.push(tomorrowReminder);
    }
  }

  for (const event of events) {
    const reminder = getEventReminder(event);
    if (reminder && reminder.at.getTime() <= next24h) {
      reminders.push(reminder);
    }
  }

  for (const block of blocks) {
    const task = block.taskId ? tasksMap.get(block.taskId) : undefined;
    const reminder = getPlannedBlockReminder(block, task);
    if (reminder && reminder.at.getTime() <= next24h) {
      reminders.push(reminder);
    }
  }

  return deduplicateReminders(reminders.filter((r) => r.at.getTime() > now));
}

export function start(
  tasks: Task[],
  events: Event[],
  blocks: PlannedEvent[],
  tasksMap: Map<number, Task>
): void {
  stop();

  const reminders = collectUpcomingReminders(tasks, events, blocks, tasksMap);

  for (const reminder of reminders) {
    scheduleReminder(reminder);
  }
}

export function stop(): void {
  for (const key of scheduledReminders.keys()) {
    cancelReminder(key);
  }
}

export function refresh(
  tasks: Task[],
  events: Event[],
  blocks: PlannedEvent[],
  tasksMap: Map<number, Task>
): void {
  start(tasks, events, blocks, tasksMap);
}

