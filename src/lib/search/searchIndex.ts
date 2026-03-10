import type { Event, Category } from '../api';
import type { Task } from '../api';

export type SearchEntity = 'event' | 'task' | 'category';

export interface SearchResult {
  entity: SearchEntity;
  id: number;
  title: string;
  subtitle?: string;
  date?: Date;
  score: number;
  meta?: Record<string, unknown>;
}

interface SearchParams {
  query: string;
  events: Event[];
  tasks: Task[];
  categories: Category[];
  entityFilter?: 'all' | 'event' | 'task' | 'category';
  categoryIdFilter?: number | 'all';
  priorityFilter?: 'all' | 'low' | 'normal' | 'high' | 'urgent';
  focusOnly?: boolean;
  dateRange?: 'today' | 'week' | 'month' | 'custom';
  customStart?: Date;
  customEnd?: Date;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function calculateScore(queryTokens: string[], text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    const exactIndex = lowerText.indexOf(token);
    if (exactIndex === 0) {
      score += 10;
    } else if (exactIndex > 0) {
      score += 5;
    } else {
      const prefixMatch = lowerText.startsWith(token);
      if (prefixMatch) {
        score += 3;
      } else {
        score += 1;
      }
    }
  }

  return score;
}

function matchesDateRange(date: Date | undefined, params: SearchParams): boolean {
  if (!date) return true;
  if (!params.dateRange) return true;

  const now = new Date();
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  if (params.dateRange === 'today') {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return targetDate.getTime() === today.getTime();
  }

  if (params.dateRange === 'week') {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return targetDate >= weekStart && targetDate <= weekEnd;
  }

  if (params.dateRange === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return targetDate >= monthStart && targetDate <= monthEnd;
  }

  if (params.dateRange === 'custom' && params.customStart && params.customEnd) {
    const start = new Date(params.customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(params.customEnd);
    end.setHours(23, 59, 59, 999);
    return targetDate >= start && targetDate <= end;
  }

  return true;
}

export function searchAll(params: SearchParams): SearchResult[] {
  try {
    const query = params.query.trim();
    if (!query) {
      return [];
    }

    const queryTokens = tokenize(query);
    const results: SearchResult[] = [];

    if (params.entityFilter === 'all' || params.entityFilter === 'event' || !params.entityFilter) {
      for (const event of params.events) {
        if (!event.id) continue;

        if (params.categoryIdFilter && params.categoryIdFilter !== 'all') {
          if (event.category_id !== params.categoryIdFilter) continue;
        }

        const eventDate = new Date(event.start_time);
        if (!matchesDateRange(eventDate, params)) continue;

        const titleScore = calculateScore(queryTokens, event.title);
        const descScore = event.description ? calculateScore(queryTokens, event.description) : 0;
        const totalScore = titleScore + descScore * 0.5;

        if (totalScore > 0) {
          results.push({
            entity: 'event',
            id: event.id,
            title: event.title,
            subtitle: event.description || undefined,
            date: eventDate,
            score: totalScore,
            meta: {
              categoryId: event.category_id,
              allDay: event.all_day,
            },
          });
        }
      }
    }

    if (params.entityFilter === 'all' || params.entityFilter === 'task' || !params.entityFilter) {
      for (const task of params.tasks) {
        if (!task.id) continue;

        if (params.priorityFilter && params.priorityFilter !== 'all') {
          if (task.priority !== params.priorityFilter) continue;
        }

        if (params.focusOnly && !task.isFocus) continue;

        const taskDate = task.date ? new Date(task.date) : undefined;
        if (taskDate && !matchesDateRange(taskDate, params)) continue;

        const titleScore = calculateScore(queryTokens, task.title);
        if (titleScore > 0) {
          results.push({
            entity: 'task',
            id: task.id,
            title: task.title,
            subtitle: task.priority ? `Priority: ${task.priority}` : undefined,
            date: taskDate,
            score: titleScore,
            meta: {
              priority: task.priority,
              isFocus: task.isFocus,
              done: task.done,
            },
          });
        }
      }
    }

    if (params.entityFilter === 'all' || params.entityFilter === 'category' || !params.entityFilter) {
      for (const category of params.categories) {
        if (!category.id) continue;

        const nameScore = calculateScore(queryTokens, category.name);
        if (nameScore > 0) {
          results.push({
            entity: 'category',
            id: category.id,
            title: category.name,
            subtitle: category.color_hex ? `Color: ${category.color_hex}` : undefined,
            score: nameScore,
            meta: {
              colorHex: category.color_hex,
            },
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  } catch (err) {
    console.error('Search error', err);
    return [];
  }
}

