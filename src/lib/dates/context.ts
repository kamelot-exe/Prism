/**
 * Time context utilities
 * Maps hours to time period labels (morning, afternoon, evening)
 */

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }
  if (hour >= 17 && hour < 22) {
    return 'evening';
  }
  return 'night';
}

export function getTimePeriodLabel(hour: number): string {
  return getTimePeriod(hour);
}

export function getTimePeriodForDate(date: Date): TimePeriod {
  return getTimePeriod(date.getHours());
}

