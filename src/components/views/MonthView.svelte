<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import type { Event } from '../../lib/api';
  import { hiddenCategoryIds } from '../../stores/categoryStore';
  import { eventsStore } from '../../stores/eventsStore';
  import { normalizeDate } from '../../lib/dates/safeDate';
  import { uiNavigationStore } from '../../stores/uiNavigationStore';

  export let currentDate: Date | undefined = new Date();
  export let searchQuery = '';

  const dispatch = createEventDispatcher<{ selectEvent: Event; slot: Date }>();

  let events: Event[] = [];
  let loading = false;
  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  let unsubscribe: (() => void) | null = null;
  let hiddenIds = new Set<number>();
  let safeDate = new Date();
  $: safeDate = normalizeDate(currentDate);

  function daysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }
  function firstDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  $: filteredEvents = events
    .filter((event) => event.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((event) => {
      if (!event.category_id) return true;
      return !hiddenIds.has(event.category_id);
    });

  function handleNavigation(action: { type: string; target: Date | number | string } | null) {
    if (!action) return;
    if (action.type === 'date' && action.target instanceof Date) {
      currentDate = action.target;
    }
  }

  let navigationUnsubscribe: (() => void) | null = null;

  onMount(() => {
    const eventUnsub = eventsStore.subscribe(() => {
      if (rangeStart && rangeEnd) {
        events = eventsStore.eventsInRange(rangeStart, rangeEnd);
      }
    });
    const catUnsub = hiddenCategoryIds.subscribe((ids) => {
      hiddenIds = ids;
    });
    navigationUnsubscribe = uiNavigationStore.subscribe(handleNavigation);
    unsubscribe = () => {
      eventUnsub();
      catUnsub();
      navigationUnsubscribe?.();
    };
    loadEvents();
  });
  onDestroy(() => {
    unsubscribe?.();
    navigationUnsubscribe?.();
  });
  $: safeDate && loadEvents();

  function monthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start, end };
  }

  async function loadEvents() {
    loading = true;
    const { start, end } = monthRange(safeDate);
    rangeStart = start;
    rangeEnd = end;
    await eventsStore.loadRange(start, end).catch(() => []);
    events = eventsStore.eventsInRange(start, end);
    loading = false;
  }

  function eventsForDay(day: number) {
    const dayStart = new Date(safeDate.getFullYear(), safeDate.getMonth(), day, 0, 0, 0, 0);
    const dayEnd = new Date(safeDate.getFullYear(), safeDate.getMonth(), day, 23, 59, 59, 999);
    return filteredEvents.filter((event) => {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      return start <= dayEnd && end >= dayStart;
    });
  }

  function handleCellActivate(day: number) {
    dispatch('slot', new Date(safeDate.getFullYear(), safeDate.getMonth(), day));
  }

  function handleCellKeydown(event: KeyboardEvent, day: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCellActivate(day);
    }
  }
</script>

<div class="view">
  <div class="legend">
    <div>
      <h2>Month</h2>
      <p class="muted">Monthly event overview. Open a day to add or inspect events.</p>
    </div>
    {#if loading}<span class="pill">Loading...</span>{/if}
  </div>
  {#if filteredEvents.length === 0 && !loading}
    <div class="month-empty">No events match this month view yet. Open any day to add one.</div>
  {/if}
  <div class="weekdays">
    {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
      <div>{day}</div>
    {/each}
  </div>
  <div class="grid" role="grid" aria-label="Monthly calendar">
    {#each Array(firstDay(safeDate)).fill(null) as _}
      <div></div>
    {/each}
    {#each Array(daysInMonth(safeDate)) as _, index}
      {@const day = index + 1}
      <div
        class="cell"
        role="gridcell"
        tabindex="0"
        aria-label="{safeDate.toLocaleDateString('en-US', { month: 'long' })} {day}"
        on:click={() => handleCellActivate(day)}
        on:keydown={(event) => handleCellKeydown(event, day)}
      >
        <div class="cell-head">
          <span class="day-number">{day}</span>
          <button class="add-day" type="button" on:click|stopPropagation={() => handleCellActivate(day)} aria-label="Add event on day {day}">
            Add event
          </button>
        </div>
        <div class="events">
          {#each eventsForDay(day) as event}
            <button class="chip" type="button" on:click|stopPropagation={() => dispatch('selectEvent', event)}>
              <span class="dot"></span>
              <span>{event.title}</span>
              <small>{new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .view { display: grid; gap: 12px; animation: fadeSlide 160ms ease; }
  .legend { display: flex; justify-content: space-between; align-items: center; }
  .muted { color: var(--text-muted); margin: 0; }
  .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; text-align: center; color: var(--text-muted); font-weight: 600; }
  .month-empty {
    padding: 14px 16px;
    border: 1px dashed var(--border);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    background: var(--surface-1);
  }

  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
  .cell {
    min-height: 140px;
    background: var(--surface-0);
    border: 1px solid var(--grid-line, var(--border));
    border-radius: var(--radius-md);
    padding: 10px;
    box-shadow: var(--shadow-sm);
    display: grid;
    gap: 8px;
    cursor: pointer;
    transition: box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease;
  }
  .cell:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); border-color: var(--border-light); }
  .cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .cell-head { display: flex; justify-content: space-between; align-items: center; }
  .day-number { font-weight: 800; color: var(--text); }
  .add-day {
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    cursor: pointer;
  }
  .events { display: grid; gap: 6px; }
  .chip {
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    border-radius: var(--radius-md);
    padding: 6px 10px;
    text-align: left;
    cursor: pointer;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
    transition: box-shadow 140ms ease, transform 140ms ease, background 140ms ease, border-color 140ms ease;
  }
  .chip:hover { background: var(--surface-0); box-shadow: var(--shadow-sm); transform: translateY(-1px); border-color: var(--border-light); }
  .chip .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); box-shadow: var(--shadow-xs); }
  .chip small { color: var(--text-muted); }
  .pill { padding: 6px 10px; background: var(--accent-light, var(--surface-0)); border-radius: var(--radius-sm); color: var(--text); border: 1px solid var(--border-light); }

  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>






