import type { Event } from '../api';
import { toastStore } from '../../stores/toastStore';
import { safeInvoke } from '../safeInvoke';

type TimerId = ReturnType<typeof setTimeout>;

const MAX_SCHEDULE_WINDOW_MS = 20 * 24 * 60 * 60 * 1000;
const PROMOTION_INTERVAL_MS = 60 * 1000;

const timers = new Map<number, TimerId>();
const pendingReminders = new Map<number, Event>();
let debug = false;
let promotionInterval: ReturnType<typeof setInterval> | null = null;

function log(message: string) {
  if (debug && typeof console !== 'undefined') {
    console.debug(`[reminder] ${message}`);
  }
}

function getReminderTime(event: Event): number | null {
  if (event.reminder_minutes == null) return null;
  const start = new Date(event.start_time);
  const reminderMs = event.reminder_minutes * 60 * 1000;
  const fireAt = start.getTime() - reminderMs;
  if (fireAt <= Date.now()) return null;
  return fireAt;
}

async function showNotification(event: Event) {
  try {
    await safeInvoke('notify_event', {
      title: 'Prism Reminder',
      body: `${event.title} at ${new Date(event.start_time).toLocaleString()}`,
    });
  } catch (err) {
    console.error('Failed to show reminder notification', err);
  }
}

export function scheduleForEvent(event: Event) {
  if (!event.id) return;
  cancelForEvent(event.id);
  const fireAt = getReminderTime(event);
  if (fireAt === null) {
    log(`skip schedule ${event.title} (no reminder or past)`);
    return;
  }
  const timeout = fireAt - Date.now();
  if (timeout > MAX_SCHEDULE_WINDOW_MS) {
    pendingReminders.set(event.id, event);
    ensurePromotionInterval();
    log(`queued ${event.title} for delayed reminder scheduling`);
    return;
  }

  const id = setTimeout(() => {
    timers.delete(event.id!);
    showNotification(event);
  }, timeout);
  timers.set(event.id, id);
  log(`scheduled ${event.title} in ${Math.round(timeout / 1000)}s`);
}

export function cancelForEvent(eventId: number) {
  const existing = timers.get(eventId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(eventId);
    log(`cancelled reminder ${eventId}`);
  }

  if (pendingReminders.delete(eventId)) {
    log(`removed pending reminder ${eventId}`);
  }

  maybeStopPromotionInterval();
}

export function rescheduleForEvent(event: Event) {
  if (!event.id) return;
  cancelForEvent(event.id);
  scheduleForEvent(event);
}

export function reloadAll(events: Event[]) {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  pendingReminders.clear();
  events.forEach(scheduleForEvent);
}

export async function start(eventsLoader: () => Promise<Event[]>, enableDebug = false) {
  debug = enableDebug;
  try {
    const events = await eventsLoader();
    reloadAll(events.filter((e) => e.reminder_minutes != null));
  } catch (err) {
    console.error('Failed to start reminder scheduler', err);
    toastStore.showError('Unable to start reminders');
  }
}

function ensurePromotionInterval() {
  if (promotionInterval || pendingReminders.size === 0) return;

  promotionInterval = setInterval(() => {
    const now = Date.now();
    const promotable = Array.from(pendingReminders.values()).filter((event) => {
      const fireAt = getReminderTime(event);
      return fireAt !== null && fireAt - now <= MAX_SCHEDULE_WINDOW_MS;
    });

    promotable.forEach((event) => {
      if (!event.id) return;
      pendingReminders.delete(event.id);
      scheduleForEvent(event);
    });

    maybeStopPromotionInterval();
  }, PROMOTION_INTERVAL_MS);
}

function maybeStopPromotionInterval() {
  if (pendingReminders.size === 0 && promotionInterval) {
    clearInterval(promotionInterval);
    promotionInterval = null;
  }
}
