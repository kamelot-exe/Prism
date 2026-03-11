import type { Event } from '../api';

export interface RecurrenceExceptionRecord {
  id: number;
  eventId: number;
  occurrenceDate: string;
  action: 'skip' | 'modify';
  newStartTime?: string | null;
  newEndTime?: string | null;
}

const MAX_OCCURRENCES = 366;

function stripRrulePrefix(rule: string): string {
  return rule.startsWith('RRULE:') ? rule.slice(6) : rule;
}

function parseRRule(rule: string): Map<string, string> {
  return new Map(
    stripRrulePrefix(rule)
      .split(';')
      .map((part) => part.split('='))
      .filter((part) => part.length === 2)
      .map(([key, value]) => [key.toUpperCase(), value.toUpperCase()])
  );
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function addYears(date: Date, years: number): Date {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function weekdayToCode(date: Date): string {
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][date.getDay()];
}

function withOccurrenceTiming(baseStart: Date, baseEnd: Date, occurrenceStart: Date) {
  const duration = baseEnd.getTime() - baseStart.getTime();
  return {
    start: occurrenceStart,
    end: new Date(occurrenceStart.getTime() + duration),
  };
}

function overlapsRange(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start <= rangeEnd && end >= rangeStart;
}

function nextOccurrence(date: Date, rule: Map<string, string>, seriesStart: Date): Date | null {
  const freq = rule.get('FREQ') ?? '';
  const interval = Number.parseInt(rule.get('INTERVAL') ?? '1', 10) || 1;

  if (freq === 'DAILY') {
    return addDays(date, interval);
  }

  if (freq === 'WEEKLY') {
    const byDay = (rule.get('BYDAY') ?? '').split(',').filter(Boolean);
    if (byDay.length > 0) {
      let cursor = addDays(date, 1);
      for (let i = 0; i < 14 * interval; i += 1) {
        const weeksSinceStart = Math.floor((cursor.getTime() - seriesStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const inWeek = weeksSinceStart >= 0 && weeksSinceStart % interval === 0;
        if (inWeek && byDay.includes(weekdayToCode(cursor))) {
          const next = new Date(cursor);
          next.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
          return next;
        }
        cursor = addDays(cursor, 1);
      }
      return null;
    }
    return addDays(date, 7 * interval);
  }

  if (freq === 'MONTHLY') {
    return addMonths(date, interval);
  }

  if (freq === 'YEARLY') {
    return addYears(date, interval);
  }

  return null;
}

function exceptionForOccurrence(
  eventId: number,
  occurrenceDate: string,
  exceptionsByEvent: Map<number, RecurrenceExceptionRecord[]>
): RecurrenceExceptionRecord | undefined {
  return exceptionsByEvent.get(eventId)?.find((entry) => entry.occurrenceDate === occurrenceDate);
}

export function expandRecurringEvents(
  events: Event[],
  exceptionsByEvent: Map<number, RecurrenceExceptionRecord[]>,
  rangeStart: Date,
  rangeEnd: Date
): Event[] {
  const expanded: Event[] = [];

  for (const event of events) {
    const baseStart = new Date(event.start_time);
    const baseEnd = new Date(event.end_time);

    if (!event.recurrence_rule || event.id == null) {
      if (overlapsRange(baseStart, baseEnd, rangeStart, rangeEnd)) {
        expanded.push(event);
      }
      continue;
    }

    const rule = parseRRule(event.recurrence_rule);
    let occurrenceStart = new Date(baseStart);
    let count = 0;

    while (occurrenceStart <= rangeEnd && count < MAX_OCCURRENCES) {
      const occurrence = withOccurrenceTiming(baseStart, baseEnd, new Date(occurrenceStart));
      const occurrenceDate = toDateKey(occurrence.start);
      const exception = exceptionForOccurrence(event.id, occurrenceDate, exceptionsByEvent);

      if (!exception || exception.action !== 'skip') {
        let start = occurrence.start;
        let end = occurrence.end;

        if (exception?.action === 'modify') {
          if (exception.newStartTime) {
            start = new Date(exception.newStartTime);
          }
          if (exception.newEndTime) {
            end = new Date(exception.newEndTime);
          }
        }

        if (overlapsRange(start, end, rangeStart, rangeEnd)) {
          expanded.push({
            ...event,
            id: event.id,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            recurrence_parent_id: event.id,
            recurrence_occurrence_date: occurrenceDate,
            recurrence_edit_scope: 'occurrence',
          } as Event);
        }
      }

      const next = nextOccurrence(occurrenceStart, rule, baseStart);
      if (!next || next.getTime() === occurrenceStart.getTime()) {
        break;
      }
      occurrenceStart = next;
      count += 1;
    }
  }

  return expanded.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}
