<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Event, Category } from '../lib/api';
  import { listCategories } from '../lib/api';
  import { onMount } from 'svelte';

  export let isOpen = false;
  export let event: Event | null = null;

  const dispatch = createEventDispatcher<{ close: void; save: Event }>();

  let form: Event = {
    title: '',
    start_time: '',
    end_time: '',
    description: '',
    category_id: null,
    recurrence_rule: null,
    reminder_minutes: null,
  };

  let categories: Category[] = [];

  onMount(async () => {
    categories = await listCategories().catch(() => []);
  });

  $: if (event) {
    form = { ...event } as Event;
  } else {
    form = {
      title: '',
      start_time: '',
      end_time: '',
      description: '',
      category_id: null,
      recurrence_rule: null,
      reminder_minutes: null,
    };
  }

  function save() {
    if (!form.title || !form.start_time || !form.end_time) return;
    dispatch('save', form);
  }

  function handleCategoryChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    form = { ...form, category_id: value ? Number(value) : null };
  }
</script>

{#if isOpen}
<div class="backdrop">
  <button
    class="scrim"
    type="button"
    aria-label="Close event modal"
    on:click={() => dispatch('close')}
    on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
  ></button>
  <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
    <header>
      <div>
        <p>Event</p>
        <h2>{event ? 'Edit event' : 'New event'}</h2>
      </div>
      <button class="ghost" on:click={() => dispatch('close')}>✕</button>
    </header>

    <div class="content">
      <label>
        <span>Title</span>
        <input type="text" bind:value={form.title} placeholder="Project kickoff" />
      </label>
      <label>
        <span>Description</span>
        <textarea rows="3" bind:value={form.description}></textarea>
      </label>
      <div class="grid">
        <label>
          <span>Start</span>
          <input type="datetime-local" bind:value={form.start_time} />
        </label>
        <label>
          <span>End</span>
          <input type="datetime-local" bind:value={form.end_time} />
        </label>
      </div>
      <div class="grid">
        <label>
          <span>Category</span>
          <select on:change={handleCategoryChange}>
            <option value="">No category</option>
            {#each categories as category}
              <option value={category.id}>{category.name}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Reminder (minutes)</span>
          <input type="number" min="0" step="5" bind:value={form.reminder_minutes} />
        </label>
        <label>
          <span>Recurrence rule</span>
          <input type="text" placeholder="RRULE:FREQ=WEEKLY;INTERVAL=1" bind:value={form.recurrence_rule} />
        </label>
      </div>
    </div>

    <footer>
      <button class="ghost" on:click={() => dispatch('close')}>Cancel</button>
      <button class="primary" on:click={save}>Save</button>
    </footer>
  </div>
</div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: var(--modal-backdrop, rgba(0,0,0,0.55)); display: flex; align-items: center; justify-content: center; padding: 2rem; z-index: 40; }
  .scrim { position: absolute; inset: 0; background: transparent; border: none; padding: 0; z-index: 0; }
  .modal { position: relative; z-index: 1; width: min(900px, 100%); background: var(--modal-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--modal-shadow); padding: 1.5rem; display: grid; gap: 1rem; color: var(--text); }
  header { display: flex; align-items: center; justify-content: space-between; }
  header p { margin: 0; color: var(--text-muted); }
  header h2 { margin: 0; }
  .content { display: grid; gap: 1rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  label { display: grid; gap: 0.35rem; color: var(--text-secondary); font-size: 0.95rem; }
  input, textarea, select {
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text);
  }
  textarea { resize: vertical; }
  footer { display: flex; justify-content: flex-end; gap: 0.75rem; }
  .primary, .ghost {
    padding: 0.85rem 1.2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    cursor: pointer;
    background: var(--button-bg);
    color: var(--button-text);
  }
  .primary:hover { background: var(--button-hover); }
  .ghost { background: transparent; color: var(--text); }
  .ghost:hover { background: var(--bg-hover); }
</style>
