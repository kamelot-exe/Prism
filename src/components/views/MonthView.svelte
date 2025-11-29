<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { getEvents, type Event } from '../../lib/api';

  export let currentDate: Date;
  export let searchQuery = '';

  const dispatch = createEventDispatcher<{ selectEvent: Event; slot: Date }>();

  let events: Event[] = [];
  let loading = false;

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function daysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }
  function firstDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  $: filteredEvents = events.filter((event) => event.title.toLowerCase().includes(searchQuery.toLowerCase()));

  onMount(loadEvents);
  $: currentDate && loadEvents();

  async function loadEvents() {
    loading = true;
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    events = await getEvents(start.toISOString(), end.toISOString()).catch(() => []);
    loading = false;
  }

  function eventsForDay(day: number) {
    return filteredEvents.filter((event) => {
      const start = new Date(event.start_time);
      return start.getDate() === day && start.getMonth() === currentDate.getMonth();
    });
  }
</script>

<div class="view">
  <div class="legend">
    <div>
      <h2>Month</h2>
      <p class="muted">Plan the month with a glance.</p>
    </div>
    {#if loading}<span class="pill">Loading…</span>{/if}
  </div>
  <div class="weekdays">
    {#each weekdays as day}
      <div>{day}</div>
    {/each}
  </div>
  <div class="grid">
    {#each Array(firstDay(currentDate)).fill(null) as _}
      <div></div>
    {/each}
    {#each Array(daysInMonth(currentDate)) as _, index}
      <button
        type="button"
        class="cell"
        on:click={() => dispatch('slot', new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1))}
      >
        <div class="day-number">{index + 1}</div>
        <div class="events">
          {#each eventsForDay(index + 1) as event}
            <button class="chip" on:click|stopPropagation={() => dispatch('selectEvent', event)}>
              {event.title}
            </button>
          {/each}
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .view { display: grid; gap: 0.75rem; }
  .legend { display: flex; justify-content: space-between; align-items: center; }
  .muted { color: var(--text-muted); margin: 0; }
  .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.35rem; text-align: center; color: var(--text-muted); font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.35rem; }
  .cell { min-height: 120px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-md); padding: 0.5rem; box-shadow: var(--shadow-xs); display: grid; gap: 0.35rem; cursor: pointer; }
  .cell:hover { box-shadow: var(--shadow-sm); }
  .day-number { font-weight: 700; color: var(--text); }
  .events { display: grid; gap: 0.25rem; }
  .chip { border: none; background: var(--accent-light); color: var(--text); border-radius: var(--radius-sm); padding: 0.3rem 0.5rem; text-align: left; cursor: pointer; }
  .pill { padding: 0.35rem 0.6rem; background: var(--accent-light); border-radius: var(--radius-sm); color: var(--text); }
</style>
