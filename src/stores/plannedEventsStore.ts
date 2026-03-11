import { writable } from 'svelte/store';
import { normalizeDate } from '../lib/dates/safeDate';
import { endOfDay, startOfDay } from '../lib/dates/positioning';
import { overlaps } from '../lib/scheduler/conflicts';
import {
  createPlannedBlock,
  deletePlannedBlock,
  listPlannedBlocksRange,
  updatePlannedBlock,
  type PlannedBlockRecord,
} from '../lib/api';

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
const MIGRATION_KEY = 'prism_planned_events_sqlite_migrated';
const PRUNE_DAYS = 90;
const MIN_BLOCK_MINUTES = 5;

function makeId(): string {
  return `planned-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function coerceBlock(event: any): PlannedEvent {
  return {
    ...event,
    id: String(event.id),
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

function mapRecordToBlock(record: PlannedBlockRecord): PlannedEvent {
  return {
    id: String(record.id),
    taskId: record.taskId ?? undefined,
    title: record.title,
    start: new Date(record.start),
    end: new Date(record.end),
    completed: record.completed ?? false,
  };
}

function parseBlockId(id: string): number {
  const parsed = Number.parseInt(id, 10);
  if (!Number.isFinite(parsed)) {
    throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
  }
  return parsed;
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

function loadLegacyBlocksFromStorage(): PlannedEvent[] {
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
        // Drop invalid persisted blocks rather than importing corrupted state.
      }
    }

    if (valid.length !== all.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(valid)));
    }

    return valid;
  } catch (err) {
    console.error('Failed to load planned events from legacy storage', err);
    return [];
  }
}

function hasMigrationMarker(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(MIGRATION_KEY) === '1';
  } catch {
    return false;
  }
}

function markMigrationComplete(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    // non-critical
  }
}

function clearLegacyStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // non-critical
  }
}

async function importLegacyBlocksIfNeeded(): Promise<PlannedEvent[]> {
  const persisted = (await listPlannedBlocksRange()).map(mapRecordToBlock);
  if (persisted.length > 0) {
    return persisted;
  }

  if (hasMigrationMarker()) {
    return persisted;
  }

  const legacyBlocks = loadLegacyBlocksFromStorage();
  if (legacyBlocks.length === 0) {
    return persisted;
  }

  const starts = legacyBlocks.map((block) => block.start.getTime());
  const ends = legacyBlocks.map((block) => block.end.getTime());
  const rangeStart = new Date(Math.min(...starts));
  const rangeEnd = new Date(Math.max(...ends));
  const existingInRange = await listPlannedBlocksRange(rangeStart.toISOString(), rangeEnd.toISOString());
  if (existingInRange.length > 0) {
    return existingInRange.map(mapRecordToBlock);
  }

  for (const block of legacyBlocks) {
    await createPlannedBlock({
      taskId: block.taskId,
      title: block.title,
      start: block.start.toISOString(),
      end: block.end.toISOString(),
      completed: block.completed ?? false,
    });
  }

  markMigrationComplete();
  clearLegacyStorage();
  return (await listPlannedBlocksRange()).map(mapRecordToBlock);
}

function createPlannedEventsStore() {
  const { subscribe, set } = writable<PlannedEvent[]>([]);
  let initialized = false;
  let initializing: Promise<void> | null = null;
  let currentBlocks: PlannedEvent[] = [];

  function applyState(nextBlocks: PlannedEvent[]): PlannedEvent[] {
    currentBlocks = [...nextBlocks].sort((a, b) => a.start.getTime() - b.start.getTime());
    set(currentBlocks);
    return currentBlocks;
  }

  async function reloadFromDb(): Promise<PlannedEvent[]> {
    const blocks = (await listPlannedBlocksRange()).map(mapRecordToBlock);
    return applyState(blocks);
  }

  async function ensureLoaded(): Promise<void> {
    if (initialized) {
      return;
    }

    if (!initializing) {
      initializing = (async () => {
        const blocks = await importLegacyBlocksIfNeeded();
        applyState(blocks);
        initialized = true;
      })().catch((err) => {
        console.error('Failed to initialize planned blocks store', err);
        const legacyBlocks = loadLegacyBlocksFromStorage();
        applyState(legacyBlocks);
        initialized = true;
      }).finally(() => {
        initializing = null;
      });
    }

    await initializing;
  }

  void ensureLoaded();

  async function addBlock(block: Omit<PlannedEvent, 'id'>): Promise<PlannedEvent> {
    await ensureLoaded();
    const validated = validateBlock({ ...block, id: makeId() }, currentBlocks);
    const persisted = await createPlannedBlock({
      taskId: validated.taskId,
      title: validated.title,
      start: validated.start.toISOString(),
      end: validated.end.toISOString(),
      completed: validated.completed ?? false,
    });
    const savedBlock = mapRecordToBlock(persisted);
    applyState([...currentBlocks, savedBlock]);
    return savedBlock;
  }

  async function updateBlockPosition(id: string, newStart: Date, newEnd: Date): Promise<PlannedEvent> {
    await ensureLoaded();
    const existing = currentBlocks.find((block) => block.id === id);
    if (!existing) {
      throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
    }

    const validated = validateBlock({ ...existing, start: newStart, end: newEnd }, currentBlocks, new Set([id]));
    const persisted = await updatePlannedBlock({
      id: parseBlockId(id),
      start: validated.start.toISOString(),
      end: validated.end.toISOString(),
    });
    const savedBlock = mapRecordToBlock(persisted);
    applyState(currentBlocks.map((block) => (block.id === id ? savedBlock : block)));
    return savedBlock;
  }

  async function updateBlockDuration(id: string, newEnd: Date): Promise<PlannedEvent> {
    await ensureLoaded();
    const existing = currentBlocks.find((block) => block.id === id);
    if (!existing) {
      throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
    }

    const validated = validateBlock({ ...existing, end: newEnd }, currentBlocks, new Set([id]));
    const persisted = await updatePlannedBlock({
      id: parseBlockId(id),
      end: validated.end.toISOString(),
    });
    const savedBlock = mapRecordToBlock(persisted);
    applyState(currentBlocks.map((block) => (block.id === id ? savedBlock : block)));
    return savedBlock;
  }

  async function removeBlock(id: string): Promise<void> {
    await ensureLoaded();
    await deletePlannedBlock(parseBlockId(id));
    applyState(currentBlocks.filter((block) => block.id !== id));
  }

  async function updateBlock(id: string, patch: Partial<Omit<PlannedEvent, 'id'>>): Promise<PlannedEvent> {
    await ensureLoaded();
    const existing = currentBlocks.find((block) => block.id === id);
    if (!existing) {
      throw new PlannedBlockValidationError('not_found', `Block with id ${id} not found.`);
    }

    const candidate = { ...existing, ...patch };
    const validated = patch.start || patch.end
      ? validateBlock(candidate, currentBlocks, new Set([id]))
      : candidate;

    const persisted = await updatePlannedBlock({
      id: parseBlockId(id),
      taskId: validated.taskId,
      title: validated.title,
      start: validated.start.toISOString(),
      end: validated.end.toISOString(),
      completed: validated.completed,
    });
    const savedBlock = mapRecordToBlock(persisted);
    applyState(currentBlocks.map((block) => (block.id === id ? savedBlock : block)));
    return savedBlock;
  }

  function blocksForDate(date: Date): PlannedEvent[] {
    const targetDate = normalizeDate(date);
    return currentBlocks.filter((block) => normalizeDate(block.start).getTime() === targetDate.getTime());
  }

  async function clearForDate(date: Date): Promise<void> {
    await ensureLoaded();
    const targetBlocks = blocksForDate(date);
    for (const block of targetBlocks) {
      await deletePlannedBlock(parseBlockId(block.id));
    }
    const targetDate = normalizeDate(date);
    applyState(currentBlocks.filter((block) => normalizeDate(block.start).getTime() !== targetDate.getTime()));
  }

  async function updateBlocksBulk(updates: Array<{ id: string; start: Date; end: Date }>): Promise<PlannedEvent[]> {
    await ensureLoaded();
    const ids = new Set(updates.map((entry) => entry.id));
    const proposed = updates.map((entry) => {
      const existing = currentBlocks.find((block) => block.id === entry.id);
      if (!existing) {
        throw new PlannedBlockValidationError('not_found', `Block with id ${entry.id} not found.`);
      }
      return { ...existing, start: entry.start, end: entry.end };
    });

    const validatedBlocks = validateBatch(proposed, currentBlocks, ids);

    try {
      const persistedBlocks: PlannedEvent[] = [];
      for (const block of validatedBlocks) {
        const persisted = await updatePlannedBlock({
          id: parseBlockId(block.id),
          start: block.start.toISOString(),
          end: block.end.toISOString(),
        });
        persistedBlocks.push(mapRecordToBlock(persisted));
      }
      const persistedMap = new Map(persistedBlocks.map((block) => [block.id, block]));
      applyState(currentBlocks.map((block) => persistedMap.get(block.id) ?? block));
      return persistedBlocks;
    } catch (err) {
      await reloadFromDb();
      throw err;
    }
  }

  async function duplicateBlock(id: string, newStart: Date, newEnd: Date): Promise<PlannedEvent> {
    await ensureLoaded();
    const original = currentBlocks.find((block) => block.id === id);
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
      currentBlocks
    );

    const persisted = await createPlannedBlock({
      taskId: newBlock.taskId,
      title: newBlock.title,
      start: newBlock.start.toISOString(),
      end: newBlock.end.toISOString(),
      completed: newBlock.completed ?? false,
    });
    const savedBlock = mapRecordToBlock(persisted);
    applyState([...currentBlocks, savedBlock]);
    return savedBlock;
  }

  async function removeBlocks(ids: string[]): Promise<void> {
    await ensureLoaded();
    try {
      for (const id of ids) {
        await deletePlannedBlock(parseBlockId(id));
      }
      applyState(currentBlocks.filter((block) => !ids.includes(block.id)));
    } catch (err) {
      await reloadFromDb();
      throw err;
    }
  }

  return {
    subscribe,
    ensureLoaded,
    reloadFromDb,
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

