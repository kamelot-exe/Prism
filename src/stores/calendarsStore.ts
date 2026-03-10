/**
 * Multi-Calendar Store
 *
 * Manages user-defined calendars that events can belong to.
 * Each calendar has a name, color, visibility toggle, and optional sync source.
 * Events are linked to calendars via a `calendar_id` field (future: backend).
 * For now calendars are stored in localStorage alongside the category system.
 */

import { writable, get, derived } from 'svelte/store';

export type CalendarSource = 'local' | 'google' | 'icloud' | 'webdav';

export interface Calendar {
  id: string;
  name: string;
  /** CSS hex color, e.g. "#3b82f6" */
  color: string;
  visible: boolean;
  source: CalendarSource;
  /** Remote URL (for iCloud/WebDAV/Google sync) */
  syncUrl?: string | null;
  /** Last successful sync ISO timestamp */
  lastSync?: string | null;
  /** Whether this is the user's primary/default calendar */
  isPrimary: boolean;
  createdAt: string;
}

export type NewCalendarInput = Pick<Calendar, 'name' | 'color'> & {
  source?: CalendarSource;
  syncUrl?: string | null;
  isPrimary?: boolean;
};

// ─── Default calendars ────────────────────────────────────────────────────────

const DEFAULT_CALENDARS: Calendar[] = [
  {
    id: 'cal-personal',
    name: 'Personal',
    color: '#3b82f6',
    visible: true,
    source: 'local',
    syncUrl: null,
    lastSync: null,
    isPrimary: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cal-work',
    name: 'Work',
    color: '#10b981',
    visible: true,
    source: 'local',
    syncUrl: null,
    lastSync: null,
    isPrimary: false,
    createdAt: new Date().toISOString(),
  },
];

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'prism_calendars';

function loadFromStorage(): Calendar[] {
  if (typeof window === 'undefined') return DEFAULT_CALENDARS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CALENDARS;
    const parsed = JSON.parse(raw) as Calendar[];
    return parsed.length > 0 ? parsed : DEFAULT_CALENDARS;
  } catch {
    return DEFAULT_CALENDARS;
  }
}

function saveToStorage(calendars: Calendar[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calendars));
  } catch (err) {
    console.error('[calendarsStore] Failed to persist calendars', err);
  }
}

// ─── Store factory ────────────────────────────────────────────────────────────

function genId(): string {
  return `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createCalendarsStore() {
  const { subscribe, update, set } = writable<Calendar[]>(loadFromStorage());

  /** Add a new calendar. */
  function add(input: NewCalendarInput): Calendar {
    const calendar: Calendar = {
      id: genId(),
      name: input.name,
      color: input.color,
      visible: true,
      source: input.source ?? 'local',
      syncUrl: input.syncUrl ?? null,
      lastSync: null,
      isPrimary: input.isPrimary ?? false,
      createdAt: new Date().toISOString(),
    };
    update((cals) => {
      const next = [...cals, calendar];
      saveToStorage(next);
      return next;
    });
    return calendar;
  }

  /** Update an existing calendar. */
  function edit(id: string, patch: Partial<Omit<Calendar, 'id' | 'createdAt'>>): void {
    update((cals) => {
      const next = cals.map((c) => (c.id === id ? { ...c, ...patch } : c));
      saveToStorage(next);
      return next;
    });
  }

  /** Remove a calendar by id. Primary calendar cannot be removed. */
  function remove(id: string): boolean {
    const current = get({ subscribe });
    const target = current.find((c) => c.id === id);
    if (!target || target.isPrimary) return false;
    update((cals) => {
      const next = cals.filter((c) => c.id !== id);
      saveToStorage(next);
      return next;
    });
    return true;
  }

  /** Toggle visibility of a calendar. */
  function toggleVisibility(id: string): void {
    edit(id, { visible: !get({ subscribe }).find((c) => c.id === id)?.visible });
  }

  /** Set a calendar as primary (unsets all others). */
  function setPrimary(id: string): void {
    update((cals) => {
      const next = cals.map((c) => ({ ...c, isPrimary: c.id === id }));
      saveToStorage(next);
      return next;
    });
  }

  /** Mark a calendar as successfully synced now. */
  function markSynced(id: string): void {
    edit(id, { lastSync: new Date().toISOString() });
  }

  /** Reset to defaults (useful for tests / onboarding). */
  function reset(): void {
    set(DEFAULT_CALENDARS);
    saveToStorage(DEFAULT_CALENDARS);
  }

  /** Get the primary calendar, falling back to the first one. */
  function getPrimary(): Calendar {
    const cals = get({ subscribe });
    return cals.find((c) => c.isPrimary) ?? cals[0];
  }

  return {
    subscribe,
    add,
    edit,
    remove,
    toggleVisibility,
    setPrimary,
    markSynced,
    reset,
    getPrimary,
  };
}

export const calendarsStore = createCalendarsStore();

/** Derived store: only calendars that are currently visible. */
export const visibleCalendars = derived(calendarsStore, ($cals) =>
  $cals.filter((c) => c.visible)
);

/** Derived store: Map<id, Calendar> for O(1) lookups. */
export const calendarById = derived(calendarsStore, ($cals) =>
  new Map($cals.map((c) => [c.id, c]))
);
