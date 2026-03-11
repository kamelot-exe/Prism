import { writable, get } from 'svelte/store';
import type { ScheduleBlock } from '../lib/scheduling/engine';
import { generateSchedule } from '../lib/scheduling/engine';
import { listTasksRange } from '../lib/api';
import { eventsStore } from './eventsStore';
import { plannedEventsStore } from './plannedEventsStore';
import { pomodoroStore } from './pomodoroStore';
import { settingsStore } from './settings';
import { normalizeDate } from '../lib/dates/safeDate';

function createScheduleStore() {
  const { subscribe, set } = writable<ScheduleBlock[]>([]);

  async function generateForDate(date: Date) {
    const safeDate = normalizeDate(date);
    const startOfDay = new Date(safeDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(safeDate);
    endOfDay.setHours(23, 59, 59, 999);

    await eventsStore.loadRange(startOfDay, endOfDay);
    const eventsForDay = eventsStore.eventsInRange(startOfDay, endOfDay);

    const tasksForRange = await listTasksRange(undefined, safeDate.toISOString());
    const tasksForDay = tasksForRange.filter((task) => {
      if (task.done || !task.date) return false;
      const taskDate = normalizeDate(new Date(task.date));
      return taskDate.getTime() <= safeDate.getTime();
    });

    const plannedBlocks = plannedEventsStore.blocksForDate(safeDate);

    await pomodoroStore.loadTodaySessions(safeDate);
    let sessionsToday: any[] = [];
    const unsub = pomodoroStore.todaySessions.subscribe((sessions) => {
      sessionsToday = sessions;
    });
    unsub();

    const settings = get(settingsStore);

    const blocks = generateSchedule({
      date: safeDate,
      tasks: tasksForDay,
      events: eventsForDay,
      plannedBlocks,
      sessions: sessionsToday,
      workStart: settings?.productivity?.workDayStart ?? '09:00',
      workEnd: settings?.productivity?.workDayEnd ?? '18:00',
      focusMinutes: settings?.productivity?.pomodoroFocus ?? 25,
      breakMinutes: settings?.productivity?.pomodoroBreak ?? 5,
    });

    set(blocks);
  }

  return {
    subscribe,
    generateForDate,
    clear: () => set([]),
  };
}

export const scheduleStore = createScheduleStore();
