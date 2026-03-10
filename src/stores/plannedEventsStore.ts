import { writable, get } from 'svelte/store';
import { normalizeDate } from '../lib/dates/safeDate';
import { endOfDay, startOfDay } from '../lib/dates/positioning';
import { overlaps } from '../lib/scheduler/conflicts';

export interface PlannedEvent {
  id: string;
  taskId?: number;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  completed?: boolean;
}

export type PlannedBlockValidationCode =
  | 'not_found'
  | 'invalid_range'
  | 'too_short'
  | 'overlap'
  | 'cross_day';

export class PlannedBlockValidationError extends Error {
  code: PlannedBlockValidationCode;

  constructor(code: PlannedBlockValidationCode, message: string) {
    super(message);
    this.name = 'PlannedBlockValidationError';
    this.code = code;
  }
}

const STORAGE_KEY = 'prism_planned_events';
const PRUNE_DAYS = 90;
const MIN_BLOCK_MINUTES = 5;

function makeId(): string {
  return `planned-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function coerceBlock(event: any): PlannedEvent {
  return {
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
    completed: event.completed ?? false,
  };
}

function serialize(events: PlannedEvent[]) {
  return events.map((event) => ({
    ...event,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
  }));
}

function clampBlockToSameDay<T extends Pick<PlannedEvent, 'start' | 'end'>>(block: T): T {
  const dayStart = startOfDay(block.start);
  const dayEnd = endOfDay(block.start);
  const start = new Date(Math.max(block.start.getTime(), dayStart.getTime()));
  const end = new Date(Math.min(block.end.getTime(), dayEnd.getTime()));
  return {
    ...block,
    start,
    end,
  };
}

function validateBlock(
  block: PlannedEvent,
  allBlocks: PlannedEvent[],
  ignoredIds: Set<string> = new Set()
): PlannedEvent {
  const normalized = clampBlockToSameDay(block);
  const wasCrossDay =
    normalizeDate(block.start).getTime() !== normalizeDate(block.end).getTime() ||
    normalized.start.getTime() !== block.start.getTime() ||
    normalized.end.getTime() !== block.end.getTime();

  if (normalized.end.getTime() <= normalized.start.getTime()) {
    throw new PlannedBlockValidationError('invalid_range', 'Planned blocks must end after they start.');
  }

  const durationMinutes = (normalized.end.getTime() - normalized.start.getTime()) / (1000 * 60);
  if (durationMinutes < MIN_BLOCK_MINUTES) {
    throw new PlannedBlockValidationError('too_short', `Planned blocks must be at least ${MIN_BLOCK_MINUTES} minutes.`);
  }

  if (wasCrossDay) {
    const reclampedEnd = new Date(normalized.start.getTime() + MIN_BLOCK_MINUTES * 60 * 1000);
    if (reclampedEnd.getTime() > endOfDay(normalized.start).getTime()) {
      throw new PlannedBlockValidationError('cross_day', 'Planned blocks must stay within a single day.');
    }
  }

  for (const existingBlock of allBlocks) {
    if (ignoredIds.has(existingBlock.id) || existingBlock.id === normalized.id) {
      continue;
    }
    if (overlaps(normalized.start, normalized.end, existingBlock.start, existingBlock.end)) {
      throw new PlannedBlockValidationError('overlap', 'Planned blocks cannot overlap.');
    }
  }

  return normalized;
}

function validateBatch(
  nextBlocks: PlannedEvent[],
  allBlocks: PlannedEvent[],
  ignoredIds: Set<string>
): PlannedEvent[] {
  const remainingBlocks = allBlocks.filter((block) => !ignoredIds.has(block.id));
  const validated: PlannedEvent[] = [];

  for (const block of nextBlocks) {
    const checked = validateBlock(block, [...remainingBlocks, ...validated], ignoredIds);
    validated.push(checked);
  }

  return validated;
}

function loadFromStorage(): PlannedEvent[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PRUNE_DAYS);

    const all = parsed.map(coerceBlock).filter((event: PlannedEvent) => event.start >= cutoff);
    const valid: PlannedEvent[] = [];

    for (const block of all) {
      try {
        valid.push(validateBlock(block, valid));
      } catch {
        // Drop invalid persisted blocks rather than loading corrupted state.
      }
    }

    if (valid.length !== all.length) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(valid)));
      } catch {
        // non-critical
      }
    }

    return valid;
  } catch (err) {
    console.error('Failed to load planned events from storage', err);
    return [];
  }
}

function saveToStorage(events: PlannedEvent[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(events)));
  } catch (err) {
    console.error('Failed to save planned events to storage', err);
  }
}

function createPlannedEventsStore() {
  const { subscribe, update } = writable<PlannedEvent[]>(loadFromStorage());

  function addBlock(block: Omit<PlannedEvent, 'id'>): PlannedEvent {
    const newBlock = validateBlock({ ...block, id: makeId() }, get({ subscribe }));

    update((current) => {
      const updated = [...current, newBlock];
      saveToStorage(updated);
      return updated;
    });

    return newBlock;
  }

  function updateBlockPosition(id: string, newStart: Date, newEnd: Date): PlannedEvent {
    let updatedBlock: PlannedEvent | null = null;

    update((current) => {
      const existing = current.find((block) => block.id === id);
      if (!existing) {
        throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
      }

      updatedBlock = validateBlock({ ...existing, start: newStart, end: newEnd }, current, new Set([id]));
      const updated = current.map((block) => (block.id === id ? updatedBlock! : block));
      saveToStorage(updated);
      return updated;
    });

    if (!updatedBlock) {
      throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
    }

    return updatedBlock;
  }

  function updateBlockDuration(id: string, newEnd: Date): PlannedEvent {
    let updatedBlock: PlannedEvent | null = null;

    update((current) => {
      const existing = current.find((block) => block.id === id);
      if (!existing) {
        throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
      }

      updatedBlock = validateBlock({ ...existing, end: newEnd }, current, new Set([id]));
      const updated = current.map((block) => (block.id === id ? updatedBlock! : block));
      saveToStorage(updated);
      return updated;
    });

    if (!updatedBlock) {
      throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
    }

    return updatedBlock;
  }

  function removeBlock(id: string): void {
    update((current) => {
      const updated = current.filter((block) => block.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }

  function updateBlock(id: string, patch: Partial<Omit<PlannedEvent, 'id'>>): PlannedEvent {
    let updatedBlock: PlannedEvent | null = null;

    update((current) => {
      const existing = current.find((block) => block.id === id);
      if (!existing) {
        throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
      }

      const candidate = { ...existing, ...patch };
      updatedBlock =
        patch.start || patch.end
          ? validateBlock(candidate, current, new Set([id]))
          : candidate;

      const updated = current.map((block) => (block.id === id ? updatedBlock! : block));
      saveToStorage(updated);
      return updated;
    });

    if (!updatedBlock) {
      throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
    }

    return updatedBlock;
  }

  function blocksForDate(date: Date): PlannedEvent[] {
    const state = get({ subscribe });
    const targetDate = normalizeDate(date);

    return state.filter((block) => normalizeDate(block.start).getTime() === targetDate.getTime());
  }

  function clearForDate(date: Date): void {
    const targetDate = normalizeDate(date);
    update((current) => {
      const updated = current.filter((block) => normalizeDate(block.start).getTime() !== targetDate.getTime());
      saveToStorage(updated);
      return updated;
    });
  }

  function updateBlocksBulk(updates: Array<{ id: string; start: Date; end: Date }>): PlannedEvent[] {
    let validatedBlocks: PlannedEvent[] = [];

    update((current) => {
      const ids = new Set(updates.map((entry) => entry.id));
      const proposed = updates.map((entry) => {
        const existing = current.find((block) => block.id === entry.id);
        if (!existing) {
          throw new PlannedBlockValidationError('not_found', `Block with id ${entry.id} not found.`);
        }
        return { ...existing, start: entry.start, end: entry.end };
      });

      validatedBlocks = validateBatch(proposed, current, ids);
      const validatedMap = new Map(validatedBlocks.map((block) => [block.id, block]));
      const updated = current.map((block) => validatedMap.get(block.id) ?? block);
      saveToStorage(updated);
      return updated;
    });

    return validatedBlocks;
  }

  function duplicateBlock(id: string, newStart: Date, newEnd: Date): PlannedEvent {
    const state = get({ subscribe });
    const original = state.find((block) => block.id === id);
    if (!original) {
      throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
    }

    const newBlock = validateBlock(
      {
        ...original,
        id: makeId(),
        start: newStart,
        end: newEnd,
      },
      state
    );

    update((current) => {
      const updated = [...current, newBlock];
      saveToStorage(updated);
      return updated;
    });

    return newBlock;
  }

  function removeBlocks(ids: string[]): void {
    update((current) => {
      const updated = current.filter((block) => !ids.includes(block.id));
      saveToStorage(updated);
      return updated;
    });
  }

  return {
    subscribe,
    addBlock,
    updateBlockPosition,
    updateBlockDuration,
    removeBlock,
    updateBlock,
    blocksForDate,
    clearForDate,
    updateBlocksBulk,
    duplicateBlock,
    removeBlocks,
  };
}

export const plannedEventsStore = createPlannedEventsStore();

