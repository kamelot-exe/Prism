<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Event as CalendarEvent, Category } from '../../lib/api';
  import { categoryStore } from '../../stores/categoryStore';
  import { modalBehavior } from '../../lib/modalBehavior';

  export let isOpen = false;
  export let event: CalendarEvent | null = null;

  const dispatch = createEventDispatcher<{ save: CalendarEvent; close: void }>();

  let categories: Category[] = [];
  let form: CalendarEvent = {
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    category_id: null,
    recurrence_rule: '',
    reminder_minutes: null,
  };

  const reminders = [
    { label: 'No reminder', value: null },
    { label: 'At time of event', value: 0 },
    { label: '5 minutes before', value: 5 },
    { label: '10 minutes before', value: 10 },
    { label: '30 minutes before', value: 30 },
    { label: '1 hour before', value: 60 },
    { label: '2 hours before', value: 120 },
    { label: '1 day before', value: 1440 },
  ];

  const recurrences = [
    { label: 'None', value: '' },
    { label: 'Daily', value: 'RRULE:FREQ=DAILY' },
    { label: 'Weekly', value: 'RRULE:FREQ=WEEKLY' },
    { label: 'Monthly', value: 'RRULE:FREQ=MONTHLY' },
  ];

  const toLocalInputValue = (value: string | Date | null | undefined) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const toIsoWithTimezone = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  function handleCategoryChange(event: Event) {
    const val = (event.currentTarget as HTMLSelectElement).value;
    form = { ...form, category_id: val ? Number(val) : null };
  }

  function handleReminderChange(event: Event) {
    const val = (event.currentTarget as HTMLSelectElement).value;
    form = { ...form, reminder_minutes: val ? Number(val) : null };
  }

  function handleRecurrenceChange(event: Event) {
    const val = (event.currentTarget as HTMLSelectElement).value;
    form = { ...form, recurrence_rule: val };
  }

  onMount(() => {
    const unsubscribe = categoryStore.subscribe((list) => (categories = list));
    (async () => {
      await categoryStore.loadCategories();
    })();
    return unsubscribe;
  });

  $: if (isOpen) {
    form = event
      ? {
          ...event,
          start_time: toLocalInputValue(event.start_time),
          end_time: toLocalInputValue(event.end_time),
        }
      : {
          title: '',
          description: '',
          start_time: toLocalInputValue(new Date()),
          end_time: toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
          category_id: null,
          recurrence_rule: '',
          reminder_minutes: null,
        };
  }

  function close() {
    dispatch('close');
  }

  let validationError: string | null = null;
  let isSaving = false;
  let firstInput: HTMLInputElement | null = null;

  function save() {
    validationError = null;
    if (!form.title?.trim()) {
      validationError = 'Title is required.';
      isSaving = false;
      return;
    }
    if (!form.start_time || !form.end_time) {
      validationError = 'Start and end time are required.';
      isSaving = false;
      return;
    }
    const startIso = toIsoWithTimezone(form.start_time);
    const endIso = toIsoWithTimezone(form.end_time);
    if (!startIso || !endIso) {
      validationError = 'Invalid date/time format.';
      isSaving = false;
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      validationError = 'End time must be after start time.';
      isSaving = false;
      return;
    }
    dispatch('save', { ...form, start_time: startIso, end_time: endIso });
  }

  $: if (isOpen) {
    isSaving = false;
    validationError = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      isSaving = true;
      save();
    }
  }
</script>

{#if isOpen}
<div
  class="backdrop"
  role="presentation"
  tabindex="-1"
  use:modalBehavior={{ enabled: isOpen, onClose: close, initialFocus: () => firstInput }}
>
  <button class="scrim" aria-label="Close event modal" on:click={close}></button>
  <div class="modal elevated float-in" role="dialog" aria-modal="true" aria-labelledby="event-modal-title" on:keydown={handleKeydown}>
    <header>
      <div>
        <p class="eyebrow">Event</p>
        <h2 id="event-modal-title">{event ? 'Edit event' : 'New event'}</h2>
      </div>
      <button class="ghost" on:click={close}>Close</button>
    </header>

    <div class="grid">
      <label class="full">
        <span>Title</span>
        <input bind:this={firstInput} type="text" placeholder="Event title" bind:value={form.title} />
      </label>
      <label class="full">
        <span>Description</span>
        <textarea rows="3" placeholder="Add details, links, or agenda" bind:value={form.description}></textarea>
      </label>
      <label>
        <span>Start</span>
        <input type="datetime-local" bind:value={form.start_time} />
      </label>
      <label>
        <span>End</span>
        <input type="datetime-local" bind:value={form.end_time} />
      </label>
      <label>
        <span>Category</span>
        <select bind:value={form.category_id} on:change={handleCategoryChange}>
          <option value={''}>Uncategorized</option>
          {#each categories as category}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Reminder</span>
        <select bind:value={form.reminder_minutes} on:change={handleReminderChange}>
          {#each reminders as option}
            <option value={option.value ?? ''}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Recurrence</span>
        <select bind:value={form.recurrence_rule} on:change={handleRecurrenceChange}>
          {#each recurrences as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
    </div>

  {#if validationError}
    <p class="validation-error" role="alert">{validationError}</p>
  {/if}

  <footer>
    <button class="ghost" on:click={close}>Cancel</button>
    <button class="primary" on:click={() => { isSaving = true; save(); }} disabled={isSaving} aria-busy={isSaving}>
      {#if isSaving}<span class="spinner"></span>{/if}
      <span>Save</span>
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
    z-index: 75;
  }
  .scrim { position: absolute; inset: 0; background: transparent; border: none; }
  .modal {
    width: min(820px, 100%);
    padding: 16px 18px;
    border-radius: var(--radius-lg);
    color: var(--text);
    background: var(--surface-0);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    animation: modalIn 160ms ease;
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-size: 0.8rem; }
  h2 { margin: 0.1rem 0 0 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
