export const PIXELS_PER_MINUTE = 1.2;

/**
 * Convert a Date to Y position (pixels from top of timeline)
 */
export function dateToYPosition(date: Date, dayStart: Date): number {
  const normalized = new Date(dayStart);
  normalized.setHours(0, 0, 0, 0);
  const target = new Date(date);

  const diffMs = target.getTime() - normalized.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return Math.max(0, diffMinutes * PIXELS_PER_MINUTE);
}

/**
 * Convert Y position (pixels from top) to Date
 */
export function yPositionToDate(y: number, dayStart: Date): Date {
  const normalized = new Date(dayStart);
  normalized.setHours(0, 0, 0, 0);
  const minutes = Math.max(0, y) / PIXELS_PER_MINUTE;
  const result = new Date(normalized);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Snap a value to the nearest increment
 */
export function snapToMinutes(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

/**
 * Calculate signed duration delta from drag distance.
 */
export function durationFromDrag(dragPixels: number, minMinutes: number = 5): number {
  const minutes = dragPixels / PIXELS_PER_MINUTE;
  const snapped = snapToMinutes(minutes, 5);

  if (snapped === 0) {
    return 0;
  }

  if (snapped > 0) {
    return Math.max(minMinutes, snapped);
  }

  return Math.min(-minMinutes, snapped);
}

/**
 * Get the start of a day (00:00:00)
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of a day (23:59:59)
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Clamp a time to be within day bounds (00:00 - 23:59)
 */
export function clampToDayBounds(time: Date, dayStart: Date, dayEnd: Date): Date {
  if (time < dayStart) return new Date(dayStart);
  if (time > dayEnd) return new Date(dayEnd);
  return new Date(time);
}

/**
 * Find next available 5-minute slot after a given time
 */
export function findNextSlot(after: Date, dayEnd: Date): Date {
  const next = new Date(after);
  const currentMinutes = next.getMinutes();
  const snapped = snapToMinutes(currentMinutes, 5);

  if (snapped <= currentMinutes) {
    next.setMinutes(snapped + 5, 0, 0);
  } else {
    next.setMinutes(snapped, 0, 0);
  }

  return clampToDayBounds(next, startOfDay(after), dayEnd);
}
