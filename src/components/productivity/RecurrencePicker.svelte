<script lang="ts">
  import type { Recurrence } from '../../lib/api';

  export let value: Recurrence | null = null;
  export let onChange: (next: Recurrence | null) => void = () => {};

  type RecurrenceKind = Recurrence['kind'] | 'none';

  const recurrenceKinds: Array<{ value: RecurrenceKind; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'custom', label: 'Custom' },
  ];

  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const dayValues = [0, 1, 2, 3, 4, 5, 6]; // Monday = 0, Sunday = 6

  let currentKind: RecurrenceKind = 'none';
  $: currentKind = (value?.kind || 'none') as RecurrenceKind;
  $: currentInterval = value?.interval || 1;
  $: currentDaysOfWeek = value?.daysOfWeek || [];

  function handleKindChange(newKind: RecurrenceKind) {
    if (newKind === 'none') {
      onChange(null);
      return;
    }

    const next: Recurrence = {
      kind: newKind,
      interval: currentInterval,
    };

    if (newKind === 'weekly') {
      // Default to current weekday if no days selected
      if (currentDaysOfWeek.length === 0) {
        const today = new Date().getDay();
        // Convert Sunday (0) to 6, Monday (1) to 0, etc.
        const weekday = today === 0 ? 6 : today - 1;
        next.daysOfWeek = [weekday];
      } else {
        next.daysOfWeek = [...currentDaysOfWeek];
      }
    } else if (newKind === 'custom') {
      // Custom is same as daily but with different label
      next.interval = currentInterval;
    }

    onChange(next);
  }

  function handleIntervalChange(newInterval: number) {
    if (newInterval < 1) return;

    if (currentKind === 'none') {
      return;
    }

    const next: Recurrence = {
      kind: currentKind,
      interval: newInterval,
    };

    if (currentKind === 'weekly') {
      next.daysOfWeek = [...currentDaysOfWeek];
    }

    onChange(next);
  }

  function handleDayToggle(day: number) {
    if (currentKind !== 'weekly') return;

    const newDays = currentDaysOfWeek.includes(day)
      ? currentDaysOfWeek.filter((d) => d !== day)
      : [...currentDaysOfWeek, day].sort();

    // Ensure at least one day is selected
    if (newDays.length === 0) {
      return;
    }

    onChange({
      kind: 'weekly',
      interval: currentInterval,
      daysOfWeek: newDays,
    });
  }

  function handleKindChangeEvent(e: Event) {
    const selectElement = e.target as HTMLSelectElement;
    handleKindChange(selectElement.value as RecurrenceKind);
  }

  function handleIntervalChangeEvent(e: Event) {
    const inputElement = e.target as HTMLInputElement;
    handleIntervalChange(parseInt(inputElement.value) || 1);
  }
</script>

<div class="recurrence-picker">
  <div class="field">
    <label for="recurrence-kind">Repeat</label>
    <select
      id="recurrence-kind"
      value={currentKind}
      on:change={handleKindChangeEvent}
    >
      {#each recurrenceKinds as kind}
        <option value={kind.value}>{kind.label}</option>
      {/each}
    </select>
  </div>

  {#if currentKind !== 'none'}
    <div class="field">
      <label for="recurrence-interval">
        {#if currentKind === 'custom'}
          Every N days
        {:else}
          Interval
        {/if}
      </label>
      <input
        id="recurrence-interval"
        type="number"
        min="1"
        value={currentInterval}
        on:input={handleIntervalChangeEvent}
      />
    </div>
  {/if}

  {#if currentKind === 'weekly'}
    <div class="field">
      <label>Days of week</label>
      <div class="day-chips">
        {#each dayValues as dayValue}
          {@const dayIndex = dayValue}
          <button
            type="button"
            class="day-chip"
            class:active={currentDaysOfWeek.includes(dayIndex)}
            on:click={() => handleDayToggle(dayIndex)}
          >
            {dayLabels[dayIndex]}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .recurrence-picker {
    display: grid;
    gap: 12px;
    padding: 12px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .field {
    display: grid;
    gap: 6px;
  }

  label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
  }

  select,
  input[type="number"] {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-0);
    color: var(--text);
    font-size: 0.9rem;
    transition: border-color 150ms ease-out;
  }

  select:focus,
  input[type="number"]:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-color: var(--accent);
  }

  .day-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .day-chip {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-0);
    color: var(--text);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease-out, border-color 150ms ease-out, color 150ms ease-out;
  }

  .day-chip:hover {
    background: var(--surface-1);
    border-color: var(--border-light);
  }

  .day-chip.active {
    background: var(--accent);
    color: var(--accent-text, white);
    border-color: var(--accent);
  }

  .day-chip:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>

