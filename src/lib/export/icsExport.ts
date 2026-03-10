/**
 * ICS (iCalendar) Export
 * RFC 5545 compliant calendar export for compatibility with Google Calendar,
 * Apple iCloud, Outlook, and any CalDAV-compatible application.
 */

import type { Event, Category } from '../api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a Date as YYYYMMDDTHHMMSSZ (UTC) for ICS DTSTART/DTEND.
 */
function toIcsDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}` +
    `${pad(d.getUTCMonth() + 1)}` +
    `${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}` +
    `${pad(d.getUTCMinutes())}` +
    `${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Format an all-day date as YYYYMMDD (no time component).
 */
function toIcsDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}` +
    `${pad(d.getMonth() + 1)}` +
    `${pad(d.getDate())}`
  );
}

/**
 * Escape special characters in ICS text values per RFC 5545 §3.3.11.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Fold long ICS lines at 75 octets per RFC 5545 §3.1.
 */
function foldLine(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, MAX));
  let i = MAX;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + MAX - 1));
    i += MAX - 1;
  }
  return chunks.join('\r\n');
}

/**
 * Generate a deterministic UID for an event (for idempotent exports).
 */
function eventUid(event: Event): string {
  const host = 'prism-calendar.local';
  const id = event.id ?? `${event.start_time}-${event.title.slice(0, 8)}`;
  return `${id}@${host}`;
}

/**
 * Convert a Prism recurrence_rule string (RRULE format) to an ICS RRULE line.
 * If already in RRULE format ("FREQ=..."), emit as-is; otherwise try to parse
 * our internal simple format ("daily:1", "weekly:1:0,4", etc.).
 */
function buildRruleLine(rule: string): string {
  if (rule.toUpperCase().startsWith('FREQ=')) {
    return `RRULE:${rule}`;
  }
  // Internal format: "kind:interval[:daysOfWeek]"
  const parts = rule.split(':');
  const kind = parts[0]?.toLowerCase();
  const interval = parseInt(parts[1] ?? '1', 10) || 1;
  const daysRaw = parts[2];

  const dayMap: Record<string, string> = {
    '0': 'MO', '1': 'TU', '2': 'WE', '3': 'TH', '4': 'FR', '5': 'SA', '6': 'SU',
  };

  switch (kind) {
    case 'daily':
      return `RRULE:FREQ=DAILY;INTERVAL=${interval}`;
    case 'weekly': {
      const days = daysRaw
        ? daysRaw.split(',').map((d) => dayMap[d] ?? '').filter(Boolean).join(',')
        : '';
      return days
        ? `RRULE:FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${days}`
        : `RRULE:FREQ=WEEKLY;INTERVAL=${interval}`;
    }
    case 'monthly':
      return `RRULE:FREQ=MONTHLY;INTERVAL=${interval}`;
    case 'yearly':
      return `RRULE:FREQ=YEARLY;INTERVAL=${interval}`;
    default:
      return `RRULE:FREQ=WEEKLY;INTERVAL=1`;
  }
}

// ─── VEVENT builder ───────────────────────────────────────────────────────────

function buildVEvent(event: Event, categories: Category[]): string {
  const lines: string[] = ['BEGIN:VEVENT'];

  lines.push(foldLine(`UID:${eventUid(event)}`));

  const category = categories.find((c) => c.id === event.category_id);
  const now = toIcsDateTime(new Date().toISOString());
  lines.push(`DTSTAMP:${now}`);

  if (event.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(event.start_time)}`);
    // ICS all-day end is exclusive (add 1 day)
    const endDate = new Date(event.end_time);
    endDate.setDate(endDate.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(endDate.toISOString())}`);
  } else {
    lines.push(`DTSTART:${toIcsDateTime(event.start_time)}`);
    lines.push(`DTEND:${toIcsDateTime(event.end_time)}`);
  }

  lines.push(foldLine(`SUMMARY:${escapeIcsText(event.title)}`));

  if (event.description) {
    lines.push(foldLine(`DESCRIPTION:${escapeIcsText(event.description)}`));
  }

  if (event.recurrence_rule) {
    lines.push(buildRruleLine(event.recurrence_rule));
  }

  if (category) {
    lines.push(foldLine(`CATEGORIES:${escapeIcsText(category.name)}`));
  }

  if (event.reminder_minutes != null && event.reminder_minutes > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      foldLine(`DESCRIPTION:Reminder: ${escapeIcsText(event.title)}`),
      `TRIGGER:-PT${event.reminder_minutes}M`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface IcsExportOptions {
  calendarName?: string;
  calendarDescription?: string;
}

/**
 * Generate a complete ICS file string from an array of events.
 */
export function exportToIcs(
  events: Event[],
  categories: Category[] = [],
  options: IcsExportOptions = {}
): string {
  const calName = escapeIcsText(options.calendarName ?? 'Prism Calendar');
  const calDesc = escapeIcsText(options.calendarDescription ?? 'Exported from Prism Calendar');

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prism Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${calName}`),
    foldLine(`X-WR-CALDESC:${calDesc}`),
    'X-WR-TIMEZONE:UTC',
  ].join('\r\n');

  const vevents = events.map((ev) => buildVEvent(ev, categories)).join('\r\n');

  return [header, vevents, 'END:VCALENDAR'].filter(Boolean).join('\r\n') + '\r\n';
}

/**
 * Trigger a browser download of the ICS file.
 */
export function downloadIcs(
  events: Event[],
  categories: Category[] = [],
  filename = 'prism-calendar.ics',
  options: IcsExportOptions = {}
): void {
  const content = exportToIcs(events, categories, options);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
