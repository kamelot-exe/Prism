<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Task, TaskPriority, Recurrence } from '../../lib/api';
  import { tasksStore } from '../../stores/tasksStore';
  import { modalBehavior } from '../../lib/modalBehavior';
  import { confirmDelete } from '../../lib/confirm';

  export let isOpen = false;
  export let task: Task | null = null;

  const dispatch = createEventDispatcher<{ close: void; saved: Task; deleted: void }>();

  let form: {
    title: string;
    date: string;
    estimatedMinutes: number;
    priority: TaskPriority;
    isFocus: boolean;
    recurrenceKind: 'none' | 'daily' | 'weekly' | 'monthly';
    recurrenceInterval: number;
    recurrenceDaysOfWeek: number[];
  } = {
    title: '',
    date: '',
    estimatedMinutes: 30,
    priority: 'normal',
    isFocus: false,
    recurrenceKind: 'none',
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: [],
  };

  let isSaving = false;
  let isDeleting = false;
  let titleError: string | null = null;
  let estimatedMinutesError: string | null = null;
  let firstInput: HTMLInputElement | null = null;

  const weekdays = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' },
  ];

  function normalizedDate(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10);
  }

  function parseRecurrence(recurrence: Recurrence | null | undefined): {
    recurrenceKind: 'none' | 'daily' | 'weekly' | 'monthly';
    recurrenceInterval: number;
    recurrenceDaysOfWeek: number[];
  } {
    if (!recurrence) {
      return { recurrenceKind: 'none', recurrenceInterval: 1, recurrenceDaysOfWeek: [] };
    }
    if (recurrence.kind === 'daily') {
      return {
        recurrenceKind: 'daily',
        recurrenceInterval: recurrence.interval ?? 1,
        recurrenceDaysOfWeek: [],
      };
    }
    if (recurrence.kind === 'weekly') {
      return {
        recurrenceKind: 'weekly',
        recurrenceInterval: recurrence.interval ?? 1,
        recurrenceDaysOfWeek: recurrence.daysOfWeek ?? [],
      };
    }
    if (recurrence.kind === 'monthly') {
      return {
        recurrenceKind: 'monthly',
        recurrenceInterval: recurrence.interval ?? 1,
        recurrenceDaysOfWeek: [],
      };
    }
    return { recurrenceKind: 'none', recurrenceInterval: 1, recurrenceDaysOfWeek: [] };
  }

  function buildRecurrence(): Recurrence | null {
    if (form.recurrenceKind === 'none') {
      return null;
    }
    if (form.recurrenceKind === 'daily') {
      return {
        kind: 'daily',
        interval: form.recurrenceInterval,
      };
    }
    if (form.recurrenceKind === 'weekly') {
      return {
        kind: 'weekly',
        interval: form.recurrenceInterval,
        daysOfWeek: form.recurrenceDaysOfWeek,
      };
    }
    if (form.recurrenceKind === 'monthly') {
      return {
        kind: 'monthly',
        interval: form.recurrenceInterval,
      };
    }
    return null;
  }

  $: if (isOpen && task) {
    form = {
      title: task.title || '',
      date: normalizedDate(task.date),
      estimatedMinutes: task.estimatedMinutes ?? 30,
      priority: task.priority ?? 'normal',
      isFocus: task.isFocus ?? false,
      ...parseRecurrence(task.recurrence),
    };
    titleError = null;
    estimatedMinutesError = null;
    isSaving = false;
    isDeleting = false;
  }

  function validate(): boolean {
    titleError = null;
    estimatedMinutesError = null;

    if (!form.title.trim()) {
      titleError = 'Title is required';
      return false;
    }

    if (form.estimatedMinutes < 5) {
      estimatedMinutesError = 'Estimated minutes must be at least 5';
      return false;
    }

    return true;
  }

  async function handleSave() {
    if (!task?.id || !validate()) {
      return;
    }

    isSaving = true;
    try {
      const recurrence = buildRecurrence();
      const updated = await tasksStore.updateTask(task.id, {
        title: form.title.trim(),
        date: form.date || null,
        estimatedMinutes: form.estimatedMinutes,
        priority: form.priority,
        isFocus: form.isFocus,
        recurrence,
      });

      dispatch('saved', updated);
      close();
    } catch (err) {
      console.error('Failed to update task', err);
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete() {
    if (!task?.id) {
      return;
    }

    if (!confirmDelete('this task')) {
      return;
    }

    isDeleting = true;
    try {
      await tasksStore.delete(task.id);
      dispatch('deleted');
      close();
    } catch (err) {
      console.error('Failed to delete task', err);
    } finally {
      isDeleting = false;
    }
  }

  function close() {
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
    }
  }

  function toggleWeekday(day: number) {
    if (form.recurrenceDaysOfWeek.includes(day)) {
      form.recurrenceDaysOfWeek = form.recurrenceDaysOfWeek.filter((d) => d !== day);
    } else {
      form.recurrenceDaysOfWeek = [...form.recurrenceDaysOfWeek, day].sort((a, b) => a - b);
    }
  }
</script>

{#if isOpen && task}
  <div
    class="backdrop"
    role="presentation"
    tabindex="-1"
    use:modalBehavior={{ enabled: isOpen, onClose: close, initialFocus: () => firstInput }}
  >
    <button class="scrim" aria-label="Close task modal" on:click={close}></button>
    <div class="modal elevated float-in" role="dialog" aria-modal="true" aria-labelledby="task-editor-title" on:keydown={handleKeydown}>
      <header>
        <div>
          <p class="eyebrow">Task</p>
          <h2 id="task-editor-title">Edit task</h2>
        </div>
        <button class="ghost" on:click={close}>Close</button>
      </header>

      <div class="grid">
        <label class="full">
          <span>Title <span class="required">*</span></span>
          <input
            bind:this={firstInput}
            type="text"
            placeholder="Task title"
            bind:value={form.title}
            class:error={titleError !== null}
          />
          {#if titleError}
            <span class="error-message">{titleError}</span>
          {/if}
        </label>

        <label>
          <span>Date</span>
          <input type="date" bind:value={form.date} />
        </label>

        <label>
          <span>Estimated minutes</span>
          <input
            type="number"
            min="5"
            step="5"
            bind:value={form.estimatedMinutes}
            class:error={estimatedMinutesError !== null}
          />
          {#if estimatedMinutesError}
            <span class="error-message">{estimatedMinutesError}</span>
          {/if}
        </label>

        <label>
          <span>Priority</span>
          <select bind:value={form.priority}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

        <label class="full checkbox-label">
          <input type="checkbox" bind:checked={form.isFocus} />
          <span>Focus task</span>
        </label>

        <label class="full">
          <span>Recurrence</span>
          <select bind:value={form.recurrenceKind}>
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        {#if form.recurrenceKind === 'daily' || form.recurrenceKind === 'weekly' || form.recurrenceKind === 'monthly'}
          <label class="full">
            <span>Interval</span>
            <input type="number" min="1" bind:value={form.recurrenceInterval} />
            <span class="hint">
              {form.recurrenceKind === 'daily' && 'Repeat every N days'}
              {form.recurrenceKind === 'weekly' && 'Repeat every N weeks'}
              {form.recurrenceKind === 'monthly' && 'Repeat every N months'}
            </span>
          </label>
        {/if}

        {#if form.recurrenceKind === 'weekly'}
          <label class="full">
            <span>Days of week</span>
            <div class="weekdays">
              {#each weekdays as weekday}
                <button
                  type="button"
                  class="weekday-btn"
                  class:active={form.recurrenceDaysOfWeek.includes(weekday.value)}
                  on:click={() => toggleWeekday(weekday.value)}
                >
                  {weekday.label.slice(0, 3)}
                </button>
              {/each}
            </div>
          </label>
        {/if}
      </div>

      <footer>
        <button class="ghost" on:click={close} disabled={isSaving || isDeleting}>Cancel</button>
        <button
          class="danger"
          on:click={handleDelete}
          disabled={isSaving || isDeleting}
          aria-busy={isDeleting}
        >
          {#if isDeleting}<span class="spinner"></span>{/if}
          <span>Delete</span>
        </button>
        <button
          class="primary"
          on:click={handleSave}
          disabled={isSaving || isDeleting}
          aria-busy={isSaving}
        >
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
    background: var(--modal-backdrop, rgba(0, 0, 0, 0.65));
    display: grid;
    place-items: center;
    padding: 1.5rem;
    z-index: 75;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
  }
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
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  h2 {
    margin: 0.1rem 0 0 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 14px;
  }
  label {
    display: grid;
    gap: 0.35rem;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }
  label span {
    font-size: 0.95rem;
  }
  .required {
    color: #ef4444;
  }
  input,
  select,
  :global(textarea) {
    width: 100%;
    padding: 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
  }
  input:focus,
  select:focus,
  :global(textarea:focus) {
    outline: 2px solid var(--accent);
    border-color: var(--accent);
  }
  input.error {
    border-color: #ef4444;
  }
  input.error:focus {
    outline-color: #ef4444;
    border-color: #ef4444;
  }
  .error-message {
    font-size: 0.75rem;
    color: #ef4444;
    margin-top: -4px;
  }
  .full {
    grid-column: 1 / -1;
  }
  .checkbox-label {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
  }
  .checkbox-label input[type="checkbox"] {
    width: auto;
    margin: 0;
  }
  .hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .weekdays {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .weekday-btn {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 150ms ease;
  }
  .weekday-btn:hover {
    background: var(--surface-0);
    border-color: var(--accent);
  }
  .weekday-btn.active {
    background: var(--accent);
    color: var(--accent-text, white);
    border-color: var(--accent);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 14px;
  }
  .ghost,
  .primary,
  .danger {
    border-radius: var(--radius-md);
    padding: 12px 14px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-weight: 700;
    transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease,
      transform 150ms ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ghost {
    background: var(--surface-1);
    color: var(--text);
  }
  .ghost:hover:not(:disabled) {
    background: var(--surface-0);
    border-color: var(--border-light);
    box-shadow: var(--shadow-sm);
  }
  .primary {
    background: linear-gradient(135deg, var(--accent-2, var(--accent)), var(--accent));
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }
  .primary:hover:not(:disabled) {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .danger {
    background: var(--surface-1);
    color: #ef4444;
    border-color: #ef4444;
  }
  .danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes modalIn {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
