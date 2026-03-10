import { writable, derived } from 'svelte/store';
import type { SearchResult } from '../lib/search/searchIndex';
import type { TaskPriority, Event } from '../lib/api';
import { searchAll } from '../lib/search/searchIndex';
import { eventsStore } from './eventsStore';
import { tasksStore } from './tasksStore';
import { categoryStore } from './categoryStore';

// Derive a flat Event[] from the EventCache store
const eventsArray = derived(eventsStore, (cache) =>
  Array.from((cache as any).events?.values() ?? []) as Event[]
);

export interface SearchFilters {
  entity: 'all' | 'event' | 'task' | 'category';
  categoryId?: number | 'all';
  priority?: 'all' | TaskPriority;
  focusOnly?: boolean;
  dateRange?: 'today' | 'week' | 'month' | 'custom';
  customStart?: Date;
  customEnd?: Date;
}

function createSearchStore() {
  const { subscribe, set } = writable<boolean>(false);
  const queryStore = writable<string>('');
  const { subscribe: subscribeQuery, set: setQuery } = queryStore;
  const filtersStore = writable<SearchFilters>({
    entity: 'all',
    categoryId: 'all',
    priority: 'all',
    focusOnly: false,
  });
  const { subscribe: subscribeFilters, set: setFilters, update: updateFilters } = filtersStore;

  const results = derived(
    [queryStore, filtersStore, eventsArray, tasksStore, categoryStore],
    ([query, filters, events, tasks, categories]) => {
      if (!query.trim()) {
        return [];
      }

      return searchAll({
        query,
        events,
        tasks,
        categories,
        entityFilter: filters.entity,
        categoryIdFilter: filters.categoryId,
        priorityFilter: filters.priority,
        focusOnly: filters.focusOnly,
        dateRange: filters.dateRange,
        customStart: filters.customStart,
        customEnd: filters.customEnd,
      });
    }
  );

  function open() {
    set(true);
  }

  function close() {
    set(false);
    setQuery('');
    setFilters({
      entity: 'all',
      categoryId: 'all',
      priority: 'all',
      focusOnly: false,
    });
  }

  function updateQuery(query: string) {
    setQuery(query);
  }

  function updateFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    updateFilters((filters) => ({
      ...filters,
      [key]: value,
    }));
  }

  function jumpTo(result: SearchResult) {
    if (result.entity === 'event') {
      window.dispatchEvent(new CustomEvent('search-jump-event', { detail: { eventId: result.id } }));
    } else if (result.entity === 'task') {
      const date = result.date || new Date();
      window.dispatchEvent(new CustomEvent('search-jump-task', { detail: { taskId: result.id, date } }));
    } else if (result.entity === 'category') {
      window.dispatchEvent(new CustomEvent('search-jump-category', { detail: { categoryId: result.id } }));
    }
    close();
  }

  return {
    subscribe,
    query: { subscribe: subscribeQuery },
    filters: { subscribe: subscribeFilters },
    results,
    open,
    close,
    updateQuery,
    updateFilter,
    jumpTo,
  };
}

export const searchStore = createSearchStore();

