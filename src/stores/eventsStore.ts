import { writable, get } from 'svelte/store';
import type {
  Event,
  CreateEventRequest,
  UpdateEventRequest,
  RecurrenceExceptionRecord,
} from '../lib/api';
import {
  createEvent as apiCreateEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
  getEvents as apiGetEvents,
  createRecurrenceException as apiCreateRecurrenceException,
  listRecurrenceExceptions as apiListRecurrenceExceptions,
} from '../lib/api';
import {
  scheduleForEvent,
  rescheduleForEvent,
  cancelForEvent,
  reloadAll as reloadReminders,
} from '../lib/reminders/reminderScheduler';
import { toastStore } from './toastStore';
import { expandRecurringEvents } from '../lib/recurrence/expandRecurringEvents';

type IsoString = string;

interface EventCache {
  events: Map<number, Event>;
  recurrenceExceptions: Map<number, RecurrenceExceptionRecord[]>;
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
  return { ...e, recurrence_edit_scope: e.recurrence_edit_scope ?? 'series' };
}

function createEventsStore() {
  const { subscribe, update } = writable<EventCache>({
    events: new Map(),
    recurrenceExceptions: new Map(),
  });

  const upsertMany = (list: Event[]) => {
    update((state) => {
      const nextEvents = new Map(state.events);
      list.forEach((ev) => {
        if (ev.id != null) nextEvents.set(ev.id, normalizeEvent(ev));
      });
      return { ...state, events: nextEvents };
    });
  };

  const setExceptions = (entries: Array<[number, RecurrenceExceptionRecord[]]>) => {
    update((state) => {
      const next = new Map(state.recurrenceExceptions);
      entries.forEach(([eventId, records]) => {
        next.set(eventId, records);
      });
      return { ...state, recurrenceExceptions: next };
    });
  };

  const removeOne = (id: number) => {
    update((state) => {
      const nextEvents = new Map(state.events);
      nextEvents.delete(id);
      const nextExceptions = new Map(state.recurrenceExceptions);
      nextExceptions.delete(id);
      return { ...state, events: nextEvents, recurrenceExceptions: nextExceptions };
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

      const recurringEvents = fetched.filter((event) => event.id != null && event.recurrence_rule);
      const exceptions = await Promise.all(
        recurringEvents.map(async (event) => [event.id as number, await apiListRecurrenceExceptions(event.id)] as [number, RecurrenceExceptionRecord[]])
      );
      setExceptions(exceptions);
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
    return expandRecurringEvents(Array.from(state.events.values()), state.recurrenceExceptions, rangeStart, rangeEnd)
      .filter((ev) => overlaps(ev, rangeStart, rangeEnd));
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

  const updateOccurrence = async (payload: UpdateEventRequest): Promise<void> => {
    if (!payload.recurrence_parent_id || !payload.recurrence_occurrence_date || !payload.start_time || !payload.end_time) {
      toastStore.showError('Missing recurrence occurrence context');
      return;
    }

    try {
      await apiCreateRecurrenceException({
        eventId: payload.recurrence_parent_id,
        occurrenceDate: payload.recurrence_occurrence_date,
        action: 'modify',
        newStartTime: payload.start_time,
        newEndTime: payload.end_time,
      });
      toastStore.showSuccess('Occurrence updated');
      await reloadLastRange();
    } catch (error) {
      console.error('Failed to update recurrence occurrence', error);
      toastStore.showError('Could not update occurrence');
    }
  };

  const skipOccurrence = async (eventId: number, occurrenceDate: string): Promise<void> => {
    try {
      await apiCreateRecurrenceException({
        eventId,
        occurrenceDate,
        action: 'skip',
      });
      toastStore.showSuccess('Occurrence skipped');
      await reloadLastRange();
    } catch (error) {
      console.error('Failed to skip recurrence occurrence', error);
      toastStore.showError('Could not skip occurrence');
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
    updateOccurrence,
    skipOccurrence,
    delete: deleteEvent,
    reloadReminders,
    reloadLastRange,
  };

  return store;
}

export const eventsStore = createEventsStore();
