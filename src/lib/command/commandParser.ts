import type { ParsedCommand, CommandType } from './commandTypes';
import type { TaskPriority } from '../api';
import { normalizeDate } from '../dates/safeDate';

export function parseCommand(input: string, baseDate: Date = new Date()): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      type: 'task',
      title: '',
      confidence: 0,
    };
  }

  let title = trimmed;
  let type: CommandType = 'task';
  let date: Date | undefined;
  let startTime: Date | undefined;
  let endTime: Date | undefined;
  let durationMinutes: number | undefined;
  let priority: TaskPriority | undefined;
  let isFocus = false;
  let confidence = 0.5;

  const lower = trimmed.toLowerCase();

  // Detect type
  const eventKeywords = ['event', 'meeting', 'appointment', 'call', 'call with', 'meet', 'at'];
  const taskKeywords = ['task', 'todo', 'do', 'remind', 'reminder'];
  const focusKeywords = ['focus', 'focus on', 'deep work'];

  if (eventKeywords.some((kw) => lower.includes(kw))) {
    type = 'event';
    confidence += 0.2;
  } else if (focusKeywords.some((kw) => lower.includes(kw))) {
    type = 'task';
    isFocus = true;
    confidence += 0.2;
  } else if (taskKeywords.some((kw) => lower.includes(kw))) {
    type = 'task';
    confidence += 0.1;
  }

  // Detect priority
  if (lower.includes('urgent') || lower.includes('asap')) {
    priority = 'urgent';
    confidence += 0.1;
  } else if (lower.includes('high priority') || lower.includes('important')) {
    priority = 'high';
    confidence += 0.1;
  } else if (lower.includes('low priority') || lower.includes('low')) {
    priority = 'low';
    confidence += 0.05;
  }

  // Detect date
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (lower.includes('today') || lower.includes('tdy')) {
    date = normalizeDate(today);
    confidence += 0.15;
  } else if (lower.includes('tomorrow') || lower.includes('tmrw') || lower.includes('tmr')) {
    date = normalizeDate(tomorrow);
    confidence += 0.15;
  } else if (lower.includes('monday') || lower.includes('mon')) {
    date = getNextWeekday(today, 1);
    confidence += 0.15;
  } else if (lower.includes('tuesday') || lower.includes('tue')) {
    date = getNextWeekday(today, 2);
    confidence += 0.15;
  } else if (lower.includes('wednesday') || lower.includes('wed')) {
    date = getNextWeekday(today, 3);
    confidence += 0.15;
  } else if (lower.includes('thursday') || lower.includes('thu')) {
    date = getNextWeekday(today, 4);
    confidence += 0.15;
  } else if (lower.includes('friday') || lower.includes('fri')) {
    date = getNextWeekday(today, 5);
    confidence += 0.15;
  } else if (lower.includes('saturday') || lower.includes('sat')) {
    date = getNextWeekday(today, 6);
    confidence += 0.15;
  } else if (lower.includes('sunday') || lower.includes('sun')) {
    date = getNextWeekday(today, 0);
    confidence += 0.15;
  }

  // Detect time patterns
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)?/gi,
    /(\d{1,2})\s*(am|pm)/gi,
    /at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi,
  ];

  for (const pattern of timePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const timeStr = match[0];
      const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const ampm = timeMatch[3]?.toLowerCase();

        if (ampm === 'pm' && hour !== 12) {
          hour += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour = 0;
        }

        const targetDate = date ? new Date(date) : new Date(today);
        targetDate.setHours(hour, minute, 0, 0);
        startTime = targetDate;

        if (type === 'event') {
          const end = new Date(targetDate);
          end.setHours(end.getHours() + 1);
          endTime = end;
        }

        confidence += 0.2;
        break;
      }
    }
  }

  // Detect duration
  const durationPatterns = [
    /(\d+)\s*(min|minute|minutes|m)\b/gi,
    /(\d+)\s*(hour|hours|hr|hrs|h)\b/gi,
    /for\s+(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs|h|m)\b/gi,
  ];

  for (const pattern of durationPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const durationStr = match[0];
      const durationMatch = durationStr.match(/(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs|h|m)\b/i);
      if (durationMatch) {
        const value = parseInt(durationMatch[1], 10);
        const unit = durationMatch[2].toLowerCase();
        if (unit.startsWith('h') || unit === 'hr' || unit === 'hrs') {
          durationMinutes = value * 60;
        } else {
          durationMinutes = value;
        }

        if (type === 'event' && startTime) {
          const end = new Date(startTime);
          end.setMinutes(end.getMinutes() + durationMinutes);
          endTime = end;
        }

        confidence += 0.15;
        break;
      }
    }
  }

  // Clean title from parsed keywords
  title = cleanTitle(trimmed, {
    hasType: type !== 'task' || isFocus,
    hasDate: date !== undefined,
    hasTime: startTime !== undefined,
    hasDuration: durationMinutes !== undefined,
    hasPriority: priority !== undefined,
  });

  // Increase confidence if we have a meaningful title
  if (title.length > 3) {
    confidence += 0.1;
  }

  // Cap confidence at 1.0
  confidence = Math.min(1.0, confidence);

  return {
    type,
    title,
    date,
    startTime,
    endTime,
    durationMinutes,
    priority,
    isFocus,
    confidence,
  };
}

function getNextWeekday(baseDate: Date, targetDay: number): Date {
  const date = new Date(baseDate);
  const currentDay = date.getDay();
  let daysUntilTarget = targetDay - currentDay;

  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  date.setDate(date.getDate() + daysUntilTarget);
  return normalizeDate(date);
}

function cleanTitle(
  input: string,
  flags: {
    hasType: boolean;
    hasDate: boolean;
    hasTime: boolean;
    hasDuration: boolean;
    hasPriority: boolean;
  }
): string {
  let cleaned = input;

  // Remove type keywords
  if (flags.hasType) {
    cleaned = cleaned.replace(/\b(event|meeting|appointment|call|task|todo|focus|focus on|deep work)\b/gi, '');
  }

  // Remove date keywords
  if (flags.hasDate) {
    cleaned = cleaned.replace(/\b(today|tomorrow|tdy|tmrw|tmr|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, '');
  }

  // Remove time patterns
  if (flags.hasTime) {
    cleaned = cleaned.replace(/\b(at\s+)?(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/gi, '');
  }

  // Remove duration patterns
  if (flags.hasDuration) {
    cleaned = cleaned.replace(/\b(for\s+)?(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs|h|m)\b/gi, '');
  }

  // Remove priority keywords
  if (flags.hasPriority) {
    cleaned = cleaned.replace(/\b(urgent|asap|high priority|important|low priority|low)\b/gi, '');
  }

  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned || input;
}

