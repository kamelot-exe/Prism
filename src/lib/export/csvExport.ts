/**
 * CSV Export
 * Exports calendar events and/or tasks to comma-separated values format.
 * Compatible with Excel, Google Sheets, and other spreadsheet applications.
 */

import type { Event, Task, Category } from '../api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape a CSV field value: wrap in quotes if it contains commas, quotes or
 * newlines, and double up any internal double-quote characters.
 */
function csvField(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(csvField).join(',');
}

/**
 * Format an ISO timestamp as a human-readable local datetime string.
 */
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Event CSV ────────────────────────────────────────────────────────────────

const EVENT_HEADERS = [
  'ID',
  'Title',
  'Description',
  'Start',
  'End',
  'All Day',
  'Category',
  'Recurrence Rule',
  'Reminder (min)',
  'Source',
  'External ID',
  'Created At',
];

/**
 * Convert a list of events to a CSV string.
 */
export function eventsToCSV(events: Event[], categories: Category[] = []): string {
  const header = csvRow(EVENT_HEADERS);

  const rows = events.map((ev) => {
    const category = categories.find((c) => c.id === ev.category_id);
    return csvRow([
      ev.id ?? '',
      ev.title,
      ev.description ?? '',
      formatDateTime(ev.start_time),
      formatDateTime(ev.end_time),
      ev.all_day ? 'Yes' : 'No',
      category?.name ?? '',
      ev.recurrence_rule ?? '',
      ev.reminder_minutes ?? '',
      ev.source ?? '',
      ev.external_id ?? '',
      formatDateTime(ev.created_at ?? null),
    ]);
  });

  return [header, ...rows].join('\r\n') + '\r\n';
}

// ─── Task CSV ─────────────────────────────────────────────────────────────────

const TASK_HEADERS = [
  'ID',
  'Title',
  'Done',
  'Date',
  'Priority',
  'Estimated Minutes',
  'Focus Task',
  'Recurrence Kind',
  'Recurrence Interval',
  'Recurrence Days',
  'Created At',
];

/**
 * Convert a list of tasks to a CSV string.
 */
export function tasksToCSV(tasks: Task[]): string {
  const header = csvRow(TASK_HEADERS);

  const rows = tasks.map((t) => {
    const rec = t.recurrence;
    return csvRow([
      t.id ?? '',
      t.title,
      t.done ? 'Yes' : 'No',
      t.date ?? '',
      t.priority,
      t.estimatedMinutes ?? '',
      t.isFocus ? 'Yes' : 'No',
      rec?.kind ?? '',
      rec?.interval ?? '',
      rec?.daysOfWeek?.join(';') ?? '',
      formatDateTime(t.created_at ?? null),
    ]);
  });

  return [header, ...rows].join('\r\n') + '\r\n';
}

// ─── Download helper ──────────────────────────────────────────────────────────

/**
 * Trigger a browser file download with the given CSV content.
 */
export function downloadCSV(content: string, filename: string): void {
  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
