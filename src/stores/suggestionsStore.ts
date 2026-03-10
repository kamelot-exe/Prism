import { writable, get } from 'svelte/store';
import type { PomodoroSession } from '../lib/api';
import { tasksStore } from './tasksStore';
import { eventsStore } from './eventsStore';
import { pomodoroStore } from './pomodoroStore';
import { normalizeDate } from '../lib/dates/safeDate';
import {
  minutesUntil,
  isSameDay,
  isTaskOverdue,
  getShortTasks,
  calculateFocusScore,
  wouldRecurToday,
} from '../lib/suggestions/helpers';

export interface Suggestion {
  id: string;
  type:
    | 'start_task'
    | 'resume_task'
    | 'short_task'
    | 'overdue_task'
    | 'event_soon'
    | 'focus_low'
    | 'prep_event'
    | 'wrap_up';
  message: string;
  taskId?: number | null;
  relevance: number; // 0–100 score
}

function createSuggestionsStore() {
  const suggestions = writable<Suggestion[]>([]);

  function refreshSuggestions(date: Date) {
    const normalizedDate = normalizeDate(date);
    const now = new Date();
    const currentHour = now.getHours();
    
    // Collect data
    const allTasks = get(tasksStore);
    const todayTasks = allTasks.filter((task) => {
      if (!task.date) return false;
      return isSameDay(normalizeDate(task.date), normalizedDate);
    });
    
    const pendingTasks = todayTasks.filter((t) => !t.done);
    const overdueTasks = allTasks.filter((t) => isTaskOverdue(t));
    const completedTasks = todayTasks.filter((t) => t.done);
    
    // Get events for today
    const startOfDay = new Date(normalizedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(normalizedDate);
    endOfDay.setHours(23, 59, 59, 999);
    const todayEvents = eventsStore.eventsInRange(startOfDay, endOfDay);
    const upcomingEvents = todayEvents
      .filter((e) => {
        const eventStart = new Date(e.start_time);
        return eventStart > now && minutesUntil(eventStart) < 60;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    
    // Get pomodoro sessions
    // Use a synchronous get by subscribing and immediately unsubscribing
    let todaySessions: PomodoroSession[] = [];
    const unsubPomo = pomodoroStore.todaySessions.subscribe((sessions) => {
      todaySessions = sessions;
    });
    unsubPomo();
    
    const focusScore = calculateFocusScore(todaySessions, completedTasks.length);
    
    const newSuggestions: Suggestion[] = [];
    
    // Rule 1: Overdue task
    if (overdueTasks.length > 0) {
      const firstOverdue = overdueTasks[0];
      newSuggestions.push({
        id: `overdue_${firstOverdue.id}`,
        type: 'overdue_task',
        message: `You have overdue tasks — start with "${firstOverdue.title}"`,
        taskId: firstOverdue.id || null,
        relevance: 95,
      });
    }
    
    // Rule 2: Task scheduled TODAY (pending)
    if (pendingTasks.length > 0) {
      const firstPending = pendingTasks[0];
      newSuggestions.push({
        id: `start_${firstPending.id}`,
        type: 'start_task',
        message: `Start working on: "${firstPending.title}"`,
        taskId: firstPending.id || null,
        relevance: 90,
      });
    }
    
    // Rule 3: Recurring task expected today
    const recurringToday = allTasks.filter((t) => wouldRecurToday(t) && !t.done);
    if (recurringToday.length > 0) {
      const firstRecurring = recurringToday[0];
      newSuggestions.push({
        id: `recurring_${firstRecurring.id}`,
        type: 'start_task',
        message: `Your recurring task "${firstRecurring.title}" is scheduled today`,
        taskId: firstRecurring.id || null,
        relevance: 85,
      });
    }
    
    // Rule 4: Short task option
    const shortTasks = getShortTasks(pendingTasks);
    if (shortTasks.length > 0) {
      const firstShort = shortTasks[0];
      newSuggestions.push({
        id: `short_${firstShort.id}`,
        type: 'short_task',
        message: `You can complete a short task quickly: "${firstShort.title}"`,
        taskId: firstShort.id || null,
        relevance: 50,
      });
    }
    
    // Rule 5: Upcoming event
    if (upcomingEvents.length > 0) {
      const nextEvent = upcomingEvents[0];
      const minutesUntilEvent = minutesUntil(new Date(nextEvent.start_time));
      
      if (minutesUntilEvent < 10) {
        // Event very soon - prep suggestion
        newSuggestions.push({
          id: `prep_${nextEvent.id}`,
          type: 'prep_event',
          message: `You have "${nextEvent.title}" starting soon — prepare now`,
          relevance: 90,
        });
      } else if (minutesUntilEvent < 45) {
        // Event soon - warning
        const eventTime = new Date(nextEvent.start_time).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        newSuggestions.push({
          id: `event_soon_${nextEvent.id}`,
          type: 'event_soon',
          message: `You have "${nextEvent.title}" at ${eventTime} — don't start deep focus`,
          relevance: 80,
        });
      }
    }
    
    // Rule 6: Low focus score
    if (focusScore < 40) {
      newSuggestions.push({
        id: 'focus_low',
        type: 'focus_low',
        message: 'Your focus score is low — do one pomodoro',
        relevance: 70,
      });
    }
    
    // Rule 7: Wrap-up suggestion
    if (currentHour >= 20 && pendingTasks.length > 0) {
      newSuggestions.push({
        id: 'wrap_up',
        type: 'wrap_up',
        message: 'Wrap up your day — finish 1–2 small tasks',
        relevance: 40,
      });
    }
    
    // Remove conflicting suggestions
    // If event_soon within <10 min → remove start_task, resume_task, focus_low
    const hasEventVerySoon = upcomingEvents.some((e) => {
      const minutesUntilEvent = minutesUntil(new Date(e.start_time));
      return minutesUntilEvent < 10;
    });
    
    if (hasEventVerySoon) {
      const filtered = newSuggestions.filter(
        (s) =>
          s.type !== 'start_task' &&
          s.type !== 'resume_task' &&
          s.type !== 'focus_low'
      );
      newSuggestions.length = 0;
      newSuggestions.push(...filtered);
    }
    
    // Deduplicate by type and taskId
    const seen = new Set<string>();
    const unique = newSuggestions.filter((s) => {
      const key = `${s.type}_${s.taskId || 'none'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Sort by relevance (descending)
    unique.sort((a, b) => b.relevance - a.relevance);
    
    suggestions.set(unique);
  }

  return {
    suggestions: { subscribe: suggestions.subscribe },
    refreshSuggestions,
  };
}

export const suggestionsStore = createSuggestionsStore();

