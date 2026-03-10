import type { Recurrence, TaskPriority } from '../api';
import { normalizeDate } from '../dates/safeDate';

export interface ParsedTask {
  title: string;
  date: Date | null;
  priority?: TaskPriority;
  recurrence?: Recurrence;
}

/**
 * Parse natural language task input into structured task data
 */
export function parseTextToTask(text: string): ParsedTask {
  let remainingText = text.trim();
  
  // Extract priority first (removes from text)
  const priority = extractPriority(remainingText);
  if (priority) {
    const priorityKeywords = ['urgent', 'high', 'important', 'medium', 'normal', 'low', 'maybe', 'later'];
    for (const keyword of priorityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      remainingText = remainingText.replace(regex, '').trim();
    }
  }
  
  // Extract recurrence (removes from text)
  const recurrence = extractRecurrence(remainingText);
  if (recurrence) {
    const recurrencePatterns = [
      /\bevery\s+\d+\s+days?\b/gi,
      /\bevery\s+day\b/gi,
      /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi,
      /\bevery\s+week\b/gi,
      /\bevery\s+month\b/gi,
      /\bevery\s+year\b/gi,
    ];
    for (const pattern of recurrencePatterns) {
      remainingText = remainingText.replace(pattern, '').trim();
    }
  }
  
  // Extract date and time (removes from text)
  const { date, timeText } = extractDateAndTime(remainingText);
  if (timeText) {
    remainingText = remainingText.replace(timeText, '').trim();
  }
  
  // Clean up remaining text (title)
  const title = remainingText
    .replace(/\s+/g, ' ')
    .replace(/\bat\s+/gi, '')
    .replace(/\bon\s+/gi, '')
    .replace(/\bin\s+/gi, '')
    .trim();
  
  return {
    title: title || 'Untitled Task',
    date,
    priority: priority || 'normal',
    recurrence,
  };
}

/**
 * Extract priority from text
 */
function extractPriority(text: string): TaskPriority | null {
  const lower = text.toLowerCase();

  if (/\burgent\b/.test(lower)) return 'urgent';
  if (/\b(high|important)\b/.test(lower)) return 'high';
  if (/\b(low|maybe|later)\b/.test(lower)) return 'low';
  if (/\b(medium|normal)\b/.test(lower)) return 'normal';

  return null;
}

/**
 * Extract recurrence from text
 */
function extractRecurrence(text: string): Recurrence | undefined {
  const lower = text.toLowerCase();
  
  // Every day
  if (/\bevery\s+day\b/.test(lower)) {
    return { kind: 'daily', interval: 1 };
  }
  
  // Every N days
  const everyNDays = lower.match(/\bevery\s+(\d+)\s+days?\b/);
  if (everyNDays) {
    return { kind: 'daily', interval: parseInt(everyNDays[1], 10) };
  }
  
  // Every weekday
  const weekdayMap: Record<string, number> = {
    monday: 0, mon: 0,
    tuesday: 1, tue: 1, tues: 1,
    wednesday: 2, wed: 2,
    thursday: 3, thu: 3, thur: 3,
    friday: 4, fri: 4,
    saturday: 5, sat: 5,
    sunday: 6, sun: 6,
  };
  
  const everyWeekday = lower.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
  if (everyWeekday) {
    const dayName = everyWeekday[1].toLowerCase();
    const dayNum = weekdayMap[dayName];
    if (dayNum !== undefined) {
      return { kind: 'weekly', interval: 1, daysOfWeek: [dayNum] };
    }
  }
  
  // Every week
  if (/\bevery\s+week\b/.test(lower)) {
    return { kind: 'weekly', interval: 1 };
  }
  
  // Every month
  if (/\bevery\s+month\b/.test(lower)) {
    return { kind: 'monthly', interval: 1 };
  }
  
  // Every year
  if (/\bevery\s+year\b/.test(lower)) {
    return { kind: 'yearly', interval: 1 };
  }
  
  return undefined;
}

/**
 * Extract date and time from text
 */
function extractDateAndTime(text: string): { date: Date | null; timeText: string } {
  const lower = text.toLowerCase();
  let date: Date | null = null;
  let timeText = '';
  let hour = 9; // Default hour
  let minute = 0;
  
  const now = new Date();
  const today = normalizeDate(now);
  
  // Extract time first
  const timePatterns = [
    /\b(\d{1,2}):(\d{2})\b/, // 14:00, 9:30
    /\b(\d{1,2})h\b/, // 14h, 9h
    /\b(\d{1,2})\s*(am|pm)\b/i, // 2pm, 8am
    /\b(\d{1,2})\s+in\s+the\s+(morning|afternoon|evening)\b/i, // 8 in the morning
  ];
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      timeText = match[0];
      if (pattern === timePatterns[0]) {
        // HH:MM format
        hour = parseInt(match[1], 10);
        minute = parseInt(match[2], 10);
      } else if (pattern === timePatterns[1]) {
        // Nh format
        hour = parseInt(match[1], 10);
      } else if (pattern === timePatterns[2]) {
        // AM/PM format
        hour = parseInt(match[1], 10);
        const period = match[2].toLowerCase();
        if (period === 'pm' && hour !== 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;
      } else if (pattern === timePatterns[3]) {
        // "in the morning/afternoon/evening"
        hour = parseInt(match[1], 10);
        const period = match[3].toLowerCase();
        if (period === 'afternoon' && hour < 12) hour += 12;
        if (period === 'evening' && hour < 12) hour += 12;
      }
      break;
    }
  }
  
  // Extract date
  // Today
  if (/\btoday\b/.test(lower)) {
    date = new Date(today);
    date.setHours(hour, minute, 0, 0);
    return { date, timeText };
  }
  
  // Tomorrow
  if (/\btomorrow\b/.test(lower)) {
    date = new Date(today);
    date.setDate(date.getDate() + 1);
    date.setHours(hour, minute, 0, 0);
    return { date, timeText };
  }
  
  // Yesterday
  if (/\byesterday\b/.test(lower)) {
    date = new Date(today);
    date.setDate(date.getDate() - 1);
    date.setHours(hour, minute, 0, 0);
    return { date, timeText };
  }
  
  // Next weekday
  const weekdayMap: Record<string, number> = {
    monday: 0, mon: 0,
    tuesday: 1, tue: 1, tues: 1,
    wednesday: 2, wed: 2,
    thursday: 3, thu: 3, thur: 3,
    friday: 4, fri: 4,
    saturday: 5, sat: 5,
    sunday: 6, sun: 6,
  };
  
  const nextWeekday = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
  if (nextWeekday) {
    const dayName = nextWeekday[1].toLowerCase();
    const targetDay = weekdayMap[dayName];
    if (targetDay !== undefined) {
      date = new Date(today);
      const currentDay = date.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntil);
      date.setHours(hour, minute, 0, 0);
      return { date, timeText };
    }
  }
  
  // Weekday (this week or next)
  const weekdayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
  if (weekdayMatch) {
    const dayName = weekdayMatch[1].toLowerCase();
    const targetDay = weekdayMap[dayName];
    if (targetDay !== undefined) {
      date = new Date(today);
      const currentDay = date.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntil);
      date.setHours(hour, minute, 0, 0);
      return { date, timeText };
    }
  }
  
  // Relative time: "in N hours/days/weeks"
  const relativeMatch = lower.match(/\bin\s+(\d+)\s+(hour|hours|day|days|week|weeks)\b/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    date = new Date(now);
    
    if (unit.startsWith('hour')) {
      date.setHours(date.getHours() + amount);
    } else if (unit.startsWith('day')) {
      date.setDate(date.getDate() + amount);
      date.setHours(hour, minute, 0, 0);
    } else if (unit.startsWith('week')) {
      date.setDate(date.getDate() + amount * 7);
      date.setHours(hour, minute, 0, 0);
    }
    return { date, timeText };
  }
  
  // Specific date: "15 jan", "15 january", "2025-01-15"
  const datePatterns = [
    /\b(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\b/i,
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, // YYYY-MM-DD
  ];
  
  const monthMap: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern === datePatterns[0]) {
        // "15 jan" format
        const day = parseInt(match[1], 10);
        const monthName = match[2].toLowerCase();
        const month = monthMap[monthName];
        if (month !== undefined) {
          date = new Date(now.getFullYear(), month, day);
          date.setHours(hour, minute, 0, 0);
          return { date, timeText };
        }
      } else if (pattern === datePatterns[1]) {
        // YYYY-MM-DD format
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        date = new Date(year, month, day);
        date.setHours(hour, minute, 0, 0);
        return { date, timeText };
      }
    }
  }
  
  // If no date found but time was found, use today
  if (timeText) {
    date = new Date(today);
    date.setHours(hour, minute, 0, 0);
    return { date, timeText };
  }
  
  // Default: today at 9:00
  if (!date) {
    date = new Date(today);
    date.setHours(9, 0, 0, 0);
  }
  
  return { date, timeText };
}

