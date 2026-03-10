import { writable, get } from "svelte/store";
import type { ScheduleBlock } from "../lib/scheduling/engine";
import { generateSchedule } from "../lib/scheduling/engine";
import { eventsStore } from "./eventsStore";
import { tasksStore } from "./tasksStore";
import { pomodoroStore } from "./pomodoroStore";
import { settingsStore } from "./settings";
import { normalizeDate } from "../lib/dates/safeDate";

function createScheduleStore() {
  const { subscribe, set } = writable<ScheduleBlock[]>([]);

  async function generateForDate(date: Date) {
    const safeDate = normalizeDate(date);
    
    // Get date range for events
    const startOfDay = new Date(safeDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(safeDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Load events for the day
    await eventsStore.loadRange(startOfDay, endOfDay);
    const eventsForDay = eventsStore.eventsInRange(startOfDay, endOfDay);
    
    // Load tasks for the day
    await tasksStore.loadTasksForDate(safeDate);
    const allTasks = get(tasksStore);
    // Get tasks for this specific date or overdue
    const tasksForDay = allTasks.filter((t) => {
      if (t.done) return false;
      if (!t.date) return false;
      const taskDate = normalizeDate(new Date(t.date));
      const target = normalizeDate(safeDate);
      return taskDate.getTime() === target.getTime() || 
        (taskDate < target && !t.done);
    });
    
    // Load pomodoro sessions
    await pomodoroStore.loadTodaySessions(safeDate);
    // Get sessions via subscription (temporary)
    let sessionsToday: any[] = [];
    const unsub = pomodoroStore.todaySessions.subscribe((sessions) => {
      sessionsToday = sessions;
    });
    unsub();
    
    // Get settings
    const settings = get(settingsStore);
    
    const ctx = {
      date: safeDate,
      tasks: tasksForDay,
      events: eventsForDay,
      sessions: sessionsToday,
      workStart: settings?.productivity?.workDayStart ?? "09:00",
      workEnd: settings?.productivity?.workDayEnd ?? "18:00",
      focusMinutes: settings?.productivity?.pomodoroFocus ?? 25,
      breakMinutes: settings?.productivity?.pomodoroBreak ?? 5,
    };

    const blocks = generateSchedule(ctx);
    set(blocks);
  }

  return {
    subscribe,
    generateForDate,
    clear: () => set([]),
  };
}

export const scheduleStore = createScheduleStore();

