/**
 * Recurrence Exceptions
 *
 * Provides "skip once" and full exception modification for recurring events.
 * Stored in localStorage (browser) or Tauri KV when running in the desktop app.
 *
 * An exception record describes what to do on a specific recurrence occurrence:
 *   - 'skip'   → suppress that occurrence entirely ("skip once")
 *   - 'modify' → replace the occurrence with custom start/end/title/description
 */

export type ExceptionAction = 'skip' | 'modify';

export interface RecurrenceException {
  /** Unique ID for this exception record. */
  id: string;
  /** The base event ID this exception applies to. */
  eventId: number;
  /**
   * The original occurrence date (ISO YYYY-MM-DD) this exception targets.
   * We match by date so timezone shifts don't break lookups.
   */
  occurrenceDate: string;
  /** What to do with this occurrence. */
  action: ExceptionAction;
  /** New start time (ISO) – only used when action = 'modify'. */
  newStartTime?: string;
  /** New end time (ISO) – only used when action = 'modify'. */
  newEndTime?: string;
  /** Replacement title – only used when action = 'modify'. */
  newTitle?: string;
  /** Replacement description – only used when action = 'modify'. */
  newDescription?: string;
  createdAt: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'prism_recurrence_exceptions';

function load(): RecurrenceException[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecurrenceException[]) : [];
  } catch {
    return [];
  }
}

function save(exceptions: RecurrenceException[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exceptions));
  } catch (err) {
    console.error('[recurrenceExceptions] Failed to persist exceptions', err);
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Generate a simple unique ID.
 */
function genId(): string {
  return `rex-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Normalise a date to YYYY-MM-DD local string for reliable comparison.
 */
export function toOccurrenceDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * List all exceptions for a given event (all occurrences).
 */
export function listExceptionsForEvent(eventId: number): RecurrenceException[] {
  return load().filter((e) => e.eventId === eventId);
}

/**
 * Find a specific exception by eventId + occurrenceDate.
 */
export function findException(
  eventId: number,
  occurrenceDate: string
): RecurrenceException | undefined {
  return load().find(
    (e) => e.eventId === eventId && e.occurrenceDate === occurrenceDate
  );
}

/**
 * Add or update a "skip once" exception for a recurrence occurrence.
 * If an exception for that occurrence already exists it is replaced.
 */
export function skipOccurrence(
  eventId: number,
  occurrenceDate: Date | string
): RecurrenceException {
  const dateStr = toOccurrenceDate(occurrenceDate);
  const existing = findException(eventId, dateStr);
  const exceptions = load().filter(
    (e) => !(e.eventId === eventId && e.occurrenceDate === dateStr)
  );

  const record: RecurrenceException = {
    id: existing?.id ?? genId(),
    eventId,
    occurrenceDate: dateStr,
    action: 'skip',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  exceptions.push(record);
  save(exceptions);
  return record;
}

/**
 * Add or update a "modify" exception that overrides an occurrence with new data.
 */
export function modifyOccurrence(
  eventId: number,
  occurrenceDate: Date | string,
  patch: Pick<
    RecurrenceException,
    'newStartTime' | 'newEndTime' | 'newTitle' | 'newDescription'
  >
): RecurrenceException {
  const dateStr = toOccurrenceDate(occurrenceDate);
  const existing = findException(eventId, dateStr);
  const exceptions = load().filter(
    (e) => !(e.eventId === eventId && e.occurrenceDate === dateStr)
  );

  const record: RecurrenceException = {
    id: existing?.id ?? genId(),
    eventId,
    occurrenceDate: dateStr,
    action: 'modify',
    ...patch,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  exceptions.push(record);
  save(exceptions);
  return record;
}

/**
 * Remove a specific exception (restore the occurrence).
 */
export function removeException(eventId: number, occurrenceDate: Date | string): void {
  const dateStr = toOccurrenceDate(occurrenceDate);
  const exceptions = load().filter(
    (e) => !(e.eventId === eventId && e.occurrenceDate === dateStr)
  );
  save(exceptions);
}

/**
 * Remove all exceptions for an event (e.g., when the base event is deleted).
 */
export function clearExceptionsForEvent(eventId: number): void {
  const exceptions = load().filter((e) => e.eventId !== eventId);
  save(exceptions);
}

// ─── Expansion Helpers ────────────────────────────────────────────────────────

/**
 * Determine whether a given occurrence should be shown, and if so, what
 * overrides (if any) to apply.
 *
 * Returns `null` if the occurrence should be skipped, or an override patch
 * (possibly empty `{}`) if it should be shown.
 */
export function resolveOccurrence(
  eventId: number,
  occurrenceDate: Date | string
): null | Partial<Pick<RecurrenceException, 'newStartTime' | 'newEndTime' | 'newTitle' | 'newDescription'>> {
  const dateStr = toOccurrenceDate(occurrenceDate);
  const ex = findException(eventId, dateStr);
  if (!ex) return {}; // no exception → show as-is
  if (ex.action === 'skip') return null; // suppressed
  // action === 'modify'
  return {
    newStartTime: ex.newStartTime,
    newEndTime: ex.newEndTime,
    newTitle: ex.newTitle,
    newDescription: ex.newDescription,
  };
}

/**
 * Check if an occurrence has been skipped.
 */
export function isOccurrenceSkipped(eventId: number, occurrenceDate: Date | string): boolean {
  const dateStr = toOccurrenceDate(occurrenceDate);
  const ex = findException(eventId, dateStr);
  return ex?.action === 'skip';
}

/**
 * Get all skipped dates for a given event as YYYY-MM-DD strings.
 */
export function getSkippedDates(eventId: number): string[] {
  return load()
    .filter((e) => e.eventId === eventId && e.action === 'skip')
    .map((e) => e.occurrenceDate);
}
