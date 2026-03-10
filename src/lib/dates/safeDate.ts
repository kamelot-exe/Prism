export function normalizeDate(value: any): Date {
  try {
    let candidate: Date | null = null;

    if (value instanceof Date) {
      candidate = new Date(value.getTime());
    } else if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        candidate = parsed;
      }
    }

    const safe = candidate ?? new Date();
    safe.setHours(0, 0, 0, 0);
    return safe;
  } catch {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
}

/**
 * Default time for tasks: 09:00
 */
export function defaultTaskTime(): { hour: number; minute: number } {
  return { hour: 9, minute: 0 };
}

/**
 * Default time for events: 10:00
 */
export function defaultEventTime(): { hour: number; minute: number } {
  return { hour: 10, minute: 0 };
}

/**
 * Apply default time to a date, or return today with default time if date is null
 */
export function applyDefaultTime(date: Date | null, hour: number, minute: number = 0): Date {
  const baseDate = date ? new Date(date) : new Date();
  baseDate.setHours(hour, minute, 0, 0);
  return baseDate;
}
