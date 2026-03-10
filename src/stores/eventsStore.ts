import { writable, get } from 'svelte/store';
import type { Event, CreateEventRequest, UpdateEventRequest } from '../lib/api';
import {
  createEvent as apiCreateEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
  getEvents as apiGetEvents,
} from '../lib/api';
import {
  scheduleForEvent,
  rescheduleForEvent,
  cancelForEvent,
  reloadAll as reloadReminders,
} from '../lib/reminders/reminderScheduler';
import { toastStore } from './toastStore';

type IsoString = string;

interface EventCache {
  events: Map<number, Event>;
  lastLoadedRange?: { start: IsoString; end: IsoString };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toIso(date: Date): IsoString {
  return date.toISOString();
}

function overlaps(event: Event, rangeStart: Date, rangeEnd: Date): boolean {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  return start <= rangeEnd && end >= rangeStart;
}

function normalizeEvent(e: Event): Event {
  // Ensure ISO strings are preserved for consistency; Date objects are created ad hoc where needed.
  return { ...e };
}

function createEventsStore() {
  const { subscribe, update } = writable<EventCache>({ events: new Map() });

  const upsertMany = (list: Event[]) => {
    update((state) => {
      const nextEvents = new Map(state.events);
      list.forEach((ev) => {
        if (ev.id != null) nextEvents.set(ev.id, normalizeEvent(ev));
      });
      return { ...state, events: nextEvents };
    });
  };

  const removeOne = (id: number) => {
    update((state) => {
      const nextEvents = new Map(state.events);
      nextEvents.delete(id);
      return { ...state, events: nextEvents };
    });
  };

  const loadRange = async (start: Date, end: Date) => {
    const rangeStart = startOfDay(start);
    const rangeEnd = endOfDay(end);
    const startIso = toIso(rangeStart);
    const endIso = toIso(rangeEnd);
    try {
      const fetched = await apiGetEvents(startIso, endIso);
      upsertMany(fetched);
      fetched.forEach((ev) => scheduleForEvent(ev));
      update((state) => ({ ...state, lastLoadedRange: { start: startIso, end: endIso } }));
      return fetched;
    } catch (error) {
      console.error('Failed to load events', error);
      toastStore.showError('Could not load events. Please try again.');
      return [];
    }
  };

  const eventsInRange = (start: Date, end: Date): Event[] => {
    const state = get(store);
    const rangeStart = startOfDay(start);
    const rangeEnd = endOfDay(end);
    return Array.from(state.events.values()).filter((ev) => overlaps(ev, rangeStart, rangeEnd));
  };

  const getById = (id: number): Event | undefined => {
    const state = get(store);
    return state.events.get(id);
  };

  const getAll = (): Event[] => {
    const state = get(store);
    return Array.from(state.events.values());
  };

  const create = async (payload: CreateEventRequest): Promise<Event | null> => {
    try {
      const created = await apiCreateEvent(payload);
      upsertMany([created]);
      scheduleForEvent(created);
      toastStore.showSuccess('Event created');
      return created;
    } catch (error) {
      console.error('Failed to create event', error);
      toastStore.showError('Could not create event');
      return null;
    }
  };

  const updateEvent = async (payload: UpdateEventRequest): Promise<Event | null> => {
    try {
      const updated = await apiUpdateEvent(payload);
      upsertMany([updated]);
      rescheduleForEvent(updated);
      toastStore.showSuccess('Event updated');
      return updated;
    } catch (error) {
      console.error('Failed to update event', error);
      toastStore.showError('Could not update event');
      return null;
    }
  };

  const deleteEvent = async (id: number): Promise<void> => {
    try {
      await apiDeleteEvent(id);
      removeOne(id);
      cancelForEvent(id);
      toastStore.showSuccess('Event deleted');
    } catch (error) {
      console.error('Failed to delete event', error);
      toastStore.showError('Could not delete event');
      return;
    }
  };

  const reloadLastRange = async () => {
    const state = get(store);
    if (!state.lastLoadedRange) return [];
    const start = new Date(state.lastLoadedRange.start);
    const end = new Date(state.lastLoadedRange.end);
    return loadRange(start, end);
  };

  const store = {
    subscribe,
    loadRange,
    eventsInRange,
    getById,
    getAll,
    create,
    update: updateEvent,
    delete: deleteEvent,
    reloadReminders,
    reloadLastRange,
  };

  return store;
}

export const eventsStore = createEventsStore();
