<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { listCategories, type Category } from '../lib/api';

  export let isOpen = false;
  export let defaultDate: Date | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    create: { title: string; date: Date; categoryId: number | null };
  }>();

  let title = '';
  let date = '';
  let time = '';
  let categories: Category[] = [];
  let selectedCategory: number | null = null;

  onMount(async () => {
    categories = await listCategories().catch(() => []);
  });

  $: if (defaultDate) {
    const iso = defaultDate.toISOString();
    date = iso.slice(0, 10);
    time = iso.slice(11, 16);
  }

  $: colorPreview = categories.find((c) => c.id === selectedCategory)?.color_hex || '#8b5cf6';

  function submit() {
    if (!title.trim() || !date) return;
    const eventDate = new Date(`${date}T${time || '09:00'}`);
    dispatch('create', { title: title.trim(), date: eventDate, categoryId: selectedCategory });
    dispatch('close');
  }

  function handleCategoryChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    selectedCategory = value ? Number(value) : null;
  }
</script>

{#if isOpen}
<div class="backdrop">
  <button
    class="scrim"
    type="button"
    aria-label="Close quick add"
    on:click={() => dispatch('close')}
    on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
  ></button>
  <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
    <header>
      <div>
        <p>Quick Add</p>
        <h2>Create event in seconds</h2>
      </div>
      <button class="ghost" on:click={() => dispatch('close')}>✕</button>
    </header>

    <div class="grid">
      <label>
        <span>Title</span>
        <input type="text" placeholder="Standup with product" bind:value={title} />
      </label>
      <label>
        <span>Date</span>
        <input type="date" bind:value={date} />
      </label>
      <label>
        <span>Time</span>
        <input type="time" bind:value={time} />
      </label>
      <label>
        <span>Category</span>
        <select on:change={handleCategoryChange}>
          <option value="">No category</option>
          {#each categories as category}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
      </label>
      <div class="color-preview" aria-label="Color preview">
        <span>Color preview</span>
        <div class="swatch" style={`background:${colorPreview}`}></div>
      </div>
    </div>

    <footer>
      <button class="ghost" on:click={() => dispatch('close')}>Cancel</button>
      <button class="primary" on:click={submit}>Confirm</button>
    </footer>
  </div>
</div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop, rgba(0,0,0,0.45));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: 30;
  }
  .scrim { position: absolute; inset: 0; background: transparent; border: none; padding: 0; z-index: 0; }
  .modal {
    position: relative;
    z-index: 1;
    width: min(700px, 100%);
    background: var(--modal-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--modal-shadow);
    padding: 1.25rem;
    display: grid;
    gap: 1rem;
    color: var(--text);
  }
  header { display: flex; align-items: center; justify-content: space-between; }
  header p { margin: 0; color: var(--text-muted); font-size: 0.9rem; }
  header h2 { margin: 0; font-size: 1.4rem; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  label { display: grid; gap: 0.35rem; font-size: 0.95rem; color: var(--text-secondary); }
  input, select {
    padding: 0.7rem 0.85rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text);
  }
  .color-preview .swatch {
    height: 44px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }
  footer { display: flex; justify-content: flex-end; gap: 0.75rem; }
  .primary, .ghost {
    padding: 0.75rem 1.1rem;
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
