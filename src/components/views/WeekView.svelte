<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { getEvents, type Event } from '../../lib/api';

  export let currentDate: Date;
  export let searchQuery = '';

  const dispatch = createEventDispatcher<{ selectEvent: Event; slot: Date }>();

  let events: Event[] = [];
  let loading = false;

  function startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  $: weekStart = startOfWeek(currentDate);
  $: weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  $: filtered = events.filter((event) => event.title.toLowerCase().includes(searchQuery.toLowerCase()));

  onMount(loadEvents);
  $: currentDate && loadEvents();

  async function loadEvents() {
    loading = true;
    const start = new Date(weekStart);
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    events = await getEvents(start.toISOString(), end.toISOString()).catch(() => []);
    loading = false;
  }

  function eventsForDay(day: Date) {
    return filtered.filter((event) => {
      const start = new Date(event.start_time);
      return start.toDateString() === day.toDateString();
    });
  }
</script>

<div class="view">
  <div class="legend">
    <div>
      <h2>Week</h2>
      <p class="muted">Balanced agenda for the week.</p>
    </div>
    {#if loading}<span class="pill">Loading…</span>{/if}
  </div>
  <div class="week-grid">
    {#each weekDays as day}
      <button class="day" type="button" on:click={() => dispatch('slot', day)}>
        <div class="heading">
          <span class="muted">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
          <strong>{day.getDate()}</strong>
        </div>
        <div class="stack">
          {#each eventsForDay(day) as event}
            <button class="card" on:click|stopPropagation={() => dispatch('selectEvent', event)}>
              <span class="title">{event.title}</span>
              <small>{new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
            </button>
          {/each}
          <button class="ghost" on:click|stopPropagation={() => dispatch('slot', day)}>Add</button>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .view { display: grid; gap: 0.75rem; }
  .legend { display: flex; justify-content: space-between; align-items: center; }
  .muted { color: var(--text-muted); }
  .week-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }
  .day { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg); padding: 0.75rem; display: grid; gap: 0.5rem; box-shadow: var(--shadow-xs); cursor: pointer; text-align: left; color: var(--text); }
  .day { border: 1px solid var(--card-border); }
  .day:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
  .heading { display: flex; justify-content: space-between; align-items: center; color: var(--text); }
  .stack { display: grid; gap: 0.4rem; }
  .card { text-align: left; border: 1px solid var(--border); background: var(--bg-secondary); border-radius: var(--radius-md); padding: 0.5rem; color: var(--text); cursor: pointer; }
  .ghost { border: 1px dashed var(--border); background: transparent; color: var(--text-muted); border-radius: var(--radius-md); padding: 0.5rem; cursor: pointer; }
  .ghost:hover { background: var(--bg-hover); }
  .pill { padding: 0.35rem 0.6rem; background: var(--accent-light); border-radius: var(--radius-sm); color: var(--text); }
</style>
