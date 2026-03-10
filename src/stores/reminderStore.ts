import { writable, get } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { start, stop, refresh } from '../lib/reminders/reminderEngine';
import type { Reminder } from '../lib/reminders/reminderRules';
import { getTaskReminder, getEventReminder, getPlannedBlockReminder } from '../lib/reminders/reminderRules';
import { tasksStore } from './tasksStore';
import { eventsStore } from './eventsStore';
import { plannedEventsStore } from './plannedEventsStore';
import { normalizeDate } from '../lib/dates/safeDate';

let isInitialized = false;
let unsubscribeTasks: (() => void) | null = null;
let unsubscribeEvents: (() => void) | null = null;
let unsubscribeBlocks: (() => void) | null = null;

function createReminderStore() {
  const { subscribe, set } = writable<Reminder[]>([]);

  function updateUpcomingReminders() {
    const tasks = get(tasksStore);
    const events = eventsStore.getAll();
    const blocks = get(plannedEventsStore);
    
    const tasksMap = new Map<number, typeof tasks[0]>();
    for (const task of tasks) {
      if (task.id) {
        tasksMap.set(task.id, task);
      }
    }

    const today = normalizeDate(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const allReminders: Reminder[] = [];
    
    for (const task of tasks) {
      if (task.done || !task.id) continue;
      const todayReminder = getTaskReminder(task, today);
      if (todayReminder) allReminders.push(todayReminder);
      const tomorrowReminder = getTaskReminder(task, tomorrow);
      if (tomorrowReminder) allReminders.push(tomorrowReminder);
    }

    for (const event of events) {
      const reminder = getEventReminder(event);
      if (reminder) allReminders.push(reminder);
    }

    for (const block of blocks) {
      const task = block.taskId ? tasksMap.get(block.taskId) : undefined;
      const reminder = getPlannedBlockReminder(block, task);
      if (reminder) allReminders.push(reminder);
    }

    const upcoming = allReminders
      .filter((r) => r.at.getTime() > Date.now())
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    set(upcoming);
  }

  function init() {
    if (isInitialized) {
      return;
    }

    isInitialized = true;

    const tasks = get(tasksStore);
    const events = eventsStore.getAll();
    const blocks = get(plannedEventsStore);
    
    const tasksMap = new Map<number, typeof tasks[0]>();
    for (const task of tasks) {
      if (task.id) {
        tasksMap.set(task.id, task);
      }
    }

    start(tasks, events, blocks, tasksMap);
    updateUpcomingReminders();

    unsubscribeTasks = tasksStore.subscribe(() => {
      const tasks = get(tasksStore);
      const events = eventsStore.getAll();
      const blocks = get(plannedEventsStore);
      
      const tasksMap = new Map<number, typeof tasks[0]>();
      for (const task of tasks) {
        if (task.id) {
          tasksMap.set(task.id, task);
        }
      }

      refresh(tasks, events, blocks, tasksMap);
      updateUpcomingReminders();
    });

    unsubscribeEvents = eventsStore.subscribe(() => {
      const tasks = get(tasksStore);
      const events = eventsStore.getAll();
      const blocks = get(plannedEventsStore);
      
      const tasksMap = new Map<number, typeof tasks[0]>();
      for (const task of tasks) {
        if (task.id) {
          tasksMap.set(task.id, task);
        }
      }

      refresh(tasks, events, blocks, tasksMap);
      updateUpcomingReminders();
    });

    unsubscribeBlocks = plannedEventsStore.subscribe(() => {
      const tasks = get(tasksStore);
      const events = eventsStore.getAll();
      const blocks = get(plannedEventsStore);
      
      const tasksMap = new Map<number, typeof tasks[0]>();
      for (const task of tasks) {
        if (task.id) {
          tasksMap.set(task.id, task);
        }
      }

      refresh(tasks, events, blocks, tasksMap);
      updateUpcomingReminders();
    });
  }

  function cleanup() {
    if (!isInitialized) {
      return;
    }

    stop();
    unsubscribeTasks?.();
    unsubscribeEvents?.();
    unsubscribeBlocks?.();
    unsubscribeTasks = null;
    unsubscribeEvents = null;
    unsubscribeBlocks = null;
    isInitialized = false;
  }

  return {
    subscribe,
    init,
    cleanup,
    get upcomingReminders(): Readable<Reminder[]> {
      return { subscribe };
    },
  };
}

export const reminderStore = createReminderStore();

