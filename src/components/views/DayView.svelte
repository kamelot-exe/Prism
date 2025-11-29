<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { getEvents, type Event } from '../../lib/api';

  export let currentDate: Date;
  export let searchQuery = '';

  const dispatch = createEventDispatcher<{ selectEvent: Event; slot: Date }>();

  let events: Event[] = [];
  let loading = false;

  onMount(loadEvents);
  $: currentDate && loadEvents();

  async function loadEvents() {
    loading = true;
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);
    events = await getEvents(start.toISOString(), end.toISOString()).catch(() => []);
    loading = false;
  }

  $: filtered = events.filter((event) => event.title.toLowerCase().includes(searchQuery.toLowerCase()));
</script>

<div class="view">
  <div class="legend">
    <div>
      <h2>Day</h2>
      <p class="muted">Focus on a single day.</p>
    </div>
    {#if loading}<span class="pill">Loading…</span>{/if}
  </div>
  <div class="timeline">
    {#each Array(12) as _, idx}
      {#if filtered[idx]}
        <button class="card" on:click={() => dispatch('selectEvent', filtered[idx])}>
          <strong>{new Date(filtered[idx].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
          <span>{filtered[idx].title}</span>
        </button>
      {:else}
        <button class="ghost" on:click={() => dispatch('slot', new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), idx + 8))}>
          Add at {idx + 8}:00
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .view { display: grid; gap: 0.75rem; }
  .legend { display: flex; justify-content: space-between; align-items: center; }
  .muted { color: var(--text-muted); }
  .timeline { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.5rem; }
  .card { display: grid; gap: 0.25rem; align-items: start; text-align: left; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-md); padding: 0.75rem; box-shadow: var(--shadow-xs); color: var(--text); cursor: pointer; }
  .ghost { border: 1px dashed var(--border); border-radius: var(--radius-md); padding: 0.75rem; background: transparent; color: var(--text-muted); cursor: pointer; }
  .ghost:hover { background: var(--bg-hover); }
  .pill { padding: 0.35rem 0.6rem; background: var(--accent-light); border-radius: var(--radius-sm); color: var(--text); }
</style>
