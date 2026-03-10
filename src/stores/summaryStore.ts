import { get } from 'svelte/store';
import type { Event, Task } from '../lib/api';
import { eventsStore } from './eventsStore';
import { tasksStore } from './tasksStore';
import { normalizeDate } from '../lib/dates/safeDate';

/**
 * Normalizes a date to YYYY-MM-DD format for comparison
 */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Gets all summary data for a specific date
 */
export function getSummaryForDate(date: Date): {
  events: Event[];
  tasks: Task[];
  completedTasks: Task[];
  pendingTasks: Task[];
  stats: { total: number; done: number };
} {
  // Normalize the input date to ensure consistency
  const normalized = normalizeDate(date);
  const dateStr = toDateString(normalized);

  // Get events for the date (using start and end of day)
  const startOfDay = new Date(normalized);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(normalized);
  endOfDay.setHours(23, 59, 59, 999);
  
  const events = eventsStore.eventsInRange(startOfDay, endOfDay);

  // Get all tasks from store and filter by date
  const allTasks = get(tasksStore);
  const tasks = allTasks.filter((task) => {
    if (!task.date) return false;
    const taskDateStr = toDateString(normalizeDate(task.date));
    return taskDateStr === dateStr;
  });

  // Separate completed and pending tasks
  const completedTasks = tasks.filter((task) => task.done === true);
  const pendingTasks = tasks.filter((task) => !task.done);

  // Calculate statistics
  const stats = {
    total: tasks.length,
    done: completedTasks.length,
  };

  return {
    events,
    tasks,
    completedTasks,
    pendingTasks,
    stats,
  };
}

