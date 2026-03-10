import type { Event } from '../api';
import type { PlannedEvent } from '../../stores/plannedEventsStore';

/**
 * Check if two time intervals overlap
 */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Find all conflicts for a block with existing planned blocks
 */
export function blockConflicts(
  block: PlannedEvent | Omit<PlannedEvent, 'id'>,
  blocks: PlannedEvent[]
): PlannedEvent[] {
  const conflicts: PlannedEvent[] = [];
  
  for (const existingBlock of blocks) {
    // Skip self
    if ('id' in block && existingBlock.id === block.id) {
      continue;
    }
    
    if (overlaps(block.start, block.end, existingBlock.start, existingBlock.end)) {
      conflicts.push(existingBlock);
    }
  }
  
  return conflicts;
}

/**
 * Find all conflicts for a block with calendar events
 */
export function blockConflictsWithEvents(
  block: PlannedEvent | Omit<PlannedEvent, 'id'>,
  events: Event[]
): Event[] {
  const conflicts: Event[] = [];
  
  for (const event of events) {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    
    if (overlaps(block.start, block.end, eventStart, eventEnd)) {
      conflicts.push(event);
    }
  }
  
  return conflicts;
}

