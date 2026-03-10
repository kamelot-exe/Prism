import type { Task } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';

export interface Goal {
  id: string;
  title: string;
  period: 'week' | 'month';
  metric: 'tasks_done' | 'focus_tasks_done' | 'minutes_planned';
  target: number;
  enabled: boolean;
}

export interface WeeklyPlanItem {
  id: string;
  title: string;
  done: boolean;
}

export interface WeeklyPlan {
  weekKey: string;
  items: WeeklyPlanItem[];
}

export interface WeeklyMetrics {
  tasks_done: number;
  focus_tasks_done: number;
  minutes_planned: number;
}

export interface GoalProgress {
  value: number;
  target: number;
  pct: number;
}

export function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

export function computeWeeklyMetrics(
  date: Date,
  tasks: Task[],
  plannedBlocks: PlannedEvent[]
): WeeklyMetrics {
  const { start, end } = getWeekRange(date);
  
  let tasks_done = 0;
  let focus_tasks_done = 0;
  let minutes_planned = 0;
  
  for (const task of tasks) {
    if (!task.done || !task.date) continue;
    
    const taskDate = new Date(task.date);
    taskDate.setHours(0, 0, 0, 0);
    
    if (taskDate >= start && taskDate <= end) {
      tasks_done++;
      if (task.isFocus) {
        focus_tasks_done++;
      }
    }
  }
  
  for (const block of plannedBlocks) {
    const blockStart = new Date(block.start);
    blockStart.setHours(0, 0, 0, 0);
    
    if (blockStart >= start && blockStart <= end) {
      const durationMs = block.end.getTime() - block.start.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      minutes_planned += durationMinutes;
    }
  }
  
  return {
    tasks_done,
    focus_tasks_done,
    minutes_planned,
  };
}

export function computeGoalProgress(goal: Goal, metrics: WeeklyMetrics): GoalProgress {
  let value = 0;
  
  if (goal.metric === 'tasks_done') {
    value = metrics.tasks_done;
  } else if (goal.metric === 'focus_tasks_done') {
    value = metrics.focus_tasks_done;
  } else if (goal.metric === 'minutes_planned') {
    value = metrics.minutes_planned;
  }
  
  const pct = goal.target > 0 ? Math.min(100, (value / goal.target) * 100) : 0;
  
  return {
    value,
    target: goal.target,
    pct,
  };
}

