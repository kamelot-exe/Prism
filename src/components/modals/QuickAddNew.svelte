<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { categoryStore } from '../../stores/categoryStore';
  import type { Category } from '../../lib/api';
  import { modalBehavior } from '../../lib/modalBehavior';

  export let isOpen = false;
  export let defaultDate: Date | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    create: {
      title: string;
      start: string;
      end: string;
      categoryId: number | null;
      reminderMinutes: number | null;
      notes: string;
    };
  }>();

  let title = '';
  let date = '';
  let startTime = '09:00';
  let endTime = '10:00';
  let categoryId: number | null = null;
  let reminderMinutes: number | null = null;
  let notes = '';
  let categories: Category[] = [];
  let seeded = false;
  let isSaving = false;
  let titleEl: HTMLInputElement | null = null;

  function handleCategoryChange(event: Event) {
    const val = (event.currentTarget as HTMLSelectElement).value;
    categoryId = val ? Number(val) : null;
  }

  function handleReminderChange(event: Event) {
    const val = (event.currentTarget as HTMLSelectElement).value;
    reminderMinutes = val === '' ? null : Number(val);
  }

  onMount(() => {
    const unsubscribe = categoryStore.subscribe((list) => {
      categories = list;
      if (!categoryId && list.length) categoryId = list[0].id ?? null;
    });
    (async () => {
      await categoryStore.loadCategories();
    })();
    return unsubscribe;
  });

  $: if (isOpen && defaultDate && !seeded) {
    const iso = defaultDate.toISOString();
    date = iso.slice(0, 10);
    startTime = iso.slice(11, 16);
    const end = new Date(defaultDate.getTime() + 60 * 60 * 1000);
    endTime = end.toISOString().slice(11, 16);
    seeded = true;
  }
  $: if (!isOpen) {
    seeded = false;
    isSaving = false;
  }

  function close() {
    isSaving = false;
    dispatch('close');
  }

  let validationError: string | null = null;

  function create() {
    validationError = null;
    if (!title.trim()) {
      validationError = 'Title is required.';
      return;
    }
    if (!date) {
      validationError = 'Date is required.';
      return;
    }
    if (!startTime || !endTime) {
      validationError = 'Start and end time are required.';
      return;
    }
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      validationError = 'Invalid date or time.';
      return;
    }
    if (end <= start) {
      validationError = 'End time must be after start time.';
      return;
    }
    isSaving = true;
    dispatch('create', {
      title: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      categoryId,
      reminderMinutes,
      notes: notes.trim(),
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      create();
    }
  }
</script>

{#if isOpen}
<div
  class="backdrop"
  role="presentation"
  tabindex="-1"
  use:modalBehavior={{ enabled: isOpen, onClose: close, initialFocus: () => titleEl }}
>
  <button class="scrim" aria-label="Close quick add" on:click={close}></button>
  <div class="modal elevated float-in" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" on:keydown={handleKeydown}>
    <header>
      <div>
        <p class="eyebrow">Quick Add</p>
        <h2 id="quick-add-title">New event</h2>
        <p class="helper-copy">Fast event entry. Use the command palette for plain-English actions or task creation.</p>
      </div>
      <button class="ghost" on:click={close}>Close</button>
    </header>

    <div class="grid">
      <label class="full">
        <span>Event title</span>
        <input bind:this={titleEl} type="text" placeholder="Team sync, coffee chat, design review" bind:value={title} />
      </label>
      <label>
        <span>Date</span>
        <input type="date" bind:value={date} />
      </label>
      <label>
        <span>Start</span>
        <input type="time" bind:value={startTime} />
      </label>
      <label>
        <span>End</span>
        <input type="time" bind:value={endTime} />
      </label>
      <label>
        <span>Category</span>
        <select bind:value={categoryId} on:change={handleCategoryChange}>
          <option value="">Uncategorized</option>
          {#each categories as cat}
            <option value={cat.id}>{cat.name}</option>
          {/each}
          {#if categories.length === 0}
            <option value="">No category</option>
          {/if}
        </select>
      </label>
      <label>
        <span>Reminder</span>
        <select bind:value={reminderMinutes} on:change={handleReminderChange}>
          <option value={''}>No reminder</option>
          <option value={0}>At time of event</option>
          <option value={5}>5 minutes before</option>
          <option value={10}>10 minutes before</option>
          <option value={30}>30 minutes before</option>
          <option value={60}>1 hour before</option>
          <option value={120}>2 hours before</option>
          <option value={1440}>1 day before</option>
        </select>
      </label>
      <label class="full">
        <span>Notes</span>
        <textarea rows="3" placeholder="Optional notes or agenda" bind:value={notes}></textarea>
      </label>
    </div>

  {#if validationError}
    <p class="validation-error" role="alert">{validationError}</p>
  {/if}

  <footer>
    <button class="ghost" on:click={close}>Cancel</button>
    <button class="primary" on:click={create} disabled={isSaving} aria-busy={isSaving}>
      {#if isSaving}<span class="spinner"></span>{/if}
      <span>Create</span>
    </button>
  </footer>
  </div>
</div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop, rgba(0,0,0,0.65));
    display: grid;
    place-items: center;
    padding: 1.5rem;
    z-index: 70;
  }
  .modal {
    width: min(720px, 100%);
    padding: 16px 18px;
    border-radius: var(--radius-lg);
    color: var(--text);
    background: var(--surface-0);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    animation: modalIn 160ms ease;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-size: 0.8rem; }
  h2 { margin: 0.1rem 0 0 0; }
  .helper-copy {
    margin: 6px 0 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    max-width: 34rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 14px;
  }
  label { display: grid; gap: 0.35rem; color: var(--text-secondary); font-size: 0.95rem; }
  label span { font-size: 0.95rem; }
  input, select, textarea {
    width: 100%;
    padding: 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
  }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
  textarea { resize: vertical; }
  .full { grid-column: 1 / -1; }
  .validation-error {
    margin: 8px 0 0;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: var(--radius-sm);
    color: #ef4444;
    font-size: 0.875rem;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 14px;
  }
  .ghost, .primary {
    border-radius: var(--radius-md);
    padding: 12px 14px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-weight: 700;
    transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  }
  .ghost { background: var(--surface-1); color: var(--text); }
  .ghost:hover { background: var(--surface-0); border-color: var(--border-light); box-shadow: var(--shadow-sm); }
  .primary {
    background: linear-gradient(135deg, var(--accent-2, var(--accent)), var(--accent));
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }
  .primary:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }

  @keyframes modalIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>


