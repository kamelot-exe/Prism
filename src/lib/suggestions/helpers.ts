import type { Task, PomodoroSession } from '../api';
import { normalizeDate } from '../dates/safeDate';

/**
 * Calculate minutes until a given date
 */
export function minutesUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60));
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(a: Date, b: Date): boolean {
  const aNorm = normalizeDate(a);
  const bNorm = normalizeDate(b);
  return (
    aNorm.getFullYear() === bNorm.getFullYear() &&
    aNorm.getMonth() === bNorm.getMonth() &&
    aNorm.getDate() === bNorm.getDate()
  );
}

/**
 * Check if a task is overdue (date is before today and not done)
 */
export function isTaskOverdue(task: Task): boolean {
  if (!task.date || task.done) return false;
  
  const taskDate = normalizeDate(task.date);
  const today = normalizeDate(new Date());
  
  return taskDate < today;
}

/**
 * Get tasks that are short (estimated <= 30 minutes or no duration specified)
 * For now, we'll consider tasks without explicit duration as potentially short
 */
export function getShortTasks(tasks: Task[]): Task[] {
  // Since we don't have duration field in Task, we'll return all pending tasks
  // as potential short tasks. In a real implementation, you'd check task.duration
  return tasks.filter((task) => !task.done);
}

/**
 * Calculate focus score from pomodoro sessions
 * Formula: min(100, focus_minutes * 2 + completed_tasks * 5)
 * Note: completed_tasks is not available here, so we only calculate from sessions
 */
export function calculateFocusScore(
  sessionsToday: PomodoroSession[],
  completedTasksCount: number = 0
): number {
  const focusMinutes = sessionsToday
    .filter((s) => s.kind === 'focus' && s.completed)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  
  return Math.min(100, focusMinutes * 2 + completedTasksCount * 5);
}

/**
 * Check if a recurring task would generate a session today
 */
export function wouldRecurToday(task: Task): boolean {
  if (!task.recurrence || !task.date) return false;
  
  const taskDate = normalizeDate(task.date);
  const today = normalizeDate(new Date());
  
  // Simple check: if task date matches today's weekday pattern
  // This is a simplified check - full implementation would use recurrence logic
  if (task.recurrence.kind === 'daily') {
    return true; // Daily tasks recur every day
  }
  
  if (task.recurrence.kind === 'weekly' && task.recurrence.daysOfWeek) {
    const todayWeekday = today.getDay() === 0 ? 6 : today.getDay() - 1; // Convert to Mon=0, Sun=6
    return task.recurrence.daysOfWeek.includes(todayWeekday);
  }
  
  // For monthly/yearly, check if date matches
  if (task.recurrence.kind === 'monthly' || task.recurrence.kind === 'yearly') {
    return isSameDay(taskDate, today);
  }
  
  return false;
}

