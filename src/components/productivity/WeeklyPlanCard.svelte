<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { settingsStore } from '../../stores/settings';
  import { getISOWeekKey, type WeeklyPlan, type WeeklyPlanItem } from '../../lib/productivity/goals';
  import { normalizeDate } from '../../lib/dates/safeDate';
  import { get } from 'svelte/store';

  export let currentDate: Date = new Date();

  let weeklyPlan: WeeklyPlan | null = null;
  let currentWeekKey = '';
  let weeklyCarry = false;
  let newItemTitle = '';

  let unsubscribeSettings: (() => void) | null = null;

  onMount(() => {
    unsubscribeSettings = settingsStore.subscribe((settings) => {
      const safeDate = normalizeDate(currentDate);
      currentWeekKey = getISOWeekKey(safeDate);
      weeklyCarry = settings.productivity?.weeklyCarry ?? false;
      
      const allPlans = settings.productivity?.weeklyPlan || {};
      weeklyPlan = allPlans[currentWeekKey] || { weekKey: currentWeekKey, items: [] };
      
      if (weeklyPlan.weekKey !== currentWeekKey) {
        weeklyPlan.weekKey = currentWeekKey;
      }
    });
  });

  onDestroy(() => {
    unsubscribeSettings?.();
  });

  $: {
    const safeDate = normalizeDate(currentDate);
    const weekKey = getISOWeekKey(safeDate);
    
    if (weekKey !== currentWeekKey && weeklyPlan) {
      handleWeekRollover(weekKey);
    }
  }

  function handleWeekRollover(newWeekKey: string) {
    const settings = get(settingsStore);
    const allPlans = settings.productivity?.weeklyPlan || {};
    const oldPlan = allPlans[currentWeekKey];
    
    if (oldPlan && weeklyCarry) {
      const unfinishedItems = oldPlan.items.filter((item) => !item.done);
      const newPlan: WeeklyPlan = {
        weekKey: newWeekKey,
        items: unfinishedItems,
      };
      
      allPlans[newWeekKey] = newPlan;
      settingsStore.saveSettings({
        productivity: {
          ...settings.productivity,
          weeklyPlan: allPlans,
        },
      });
    }
    
    currentWeekKey = newWeekKey;
  }

  function toggleItemDone(itemId: string) {
    if (!weeklyPlan) return;
    
    const updatedItems = weeklyPlan.items.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    
    const updatedPlan: WeeklyPlan = {
      ...weeklyPlan,
      items: updatedItems,
    };
    
    const settings = get(settingsStore);
    const allPlans = settings.productivity?.weeklyPlan || {};
    allPlans[currentWeekKey] = updatedPlan;
    
    settingsStore.saveSettings({
      productivity: {
        ...settings.productivity,
        weeklyPlan: allPlans,
      },
    });
  }

  function addItem() {
    if (!newItemTitle.trim() || !weeklyPlan) return;
    
    const newItem: WeeklyPlanItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newItemTitle.trim(),
      done: false,
    };
    
    const updatedItems = [...weeklyPlan.items, newItem];
    const updatedPlan: WeeklyPlan = {
      ...weeklyPlan,
      items: updatedItems,
    };
    
    const settings = get(settingsStore);
    const allPlans = settings.productivity?.weeklyPlan || {};
    allPlans[currentWeekKey] = updatedPlan;
    
    settingsStore.saveSettings({
      productivity: {
        ...settings.productivity,
        weeklyPlan: allPlans,
      },
    });
    
    newItemTitle = '';
  }

  function removeItem(itemId: string) {
    if (!weeklyPlan) return;
    
    const updatedItems = weeklyPlan.items.filter((item) => item.id !== itemId);
    const updatedPlan: WeeklyPlan = {
      ...weeklyPlan,
      items: updatedItems,
    };
    
    const settings = get(settingsStore);
    const allPlans = settings.productivity?.weeklyPlan || {};
    allPlans[currentWeekKey] = updatedPlan;
    
    settingsStore.saveSettings({
      productivity: {
        ...settings.productivity,
        weeklyPlan: allPlans,
      },
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addItem();
    }
  }
</script>

<div class="plan-card">
  <div class="card-header">
    <div>
      <p class="eyebrow">Weekly Plan</p>
      <h4>{currentWeekKey}</h4>
    </div>
  </div>

  <div class="plan-list">
    {#if weeklyPlan && weeklyPlan.items.length > 0}
      {#each weeklyPlan.items as item (item.id)}
        <div class="plan-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={item.done}
              on:change={() => toggleItemDone(item.id)}
            />
            <span class:done={item.done}>{item.title}</span>
          </label>
          <button
            class="remove-btn"
            on:click={() => removeItem(item.id)}
            aria-label="Remove item"
            title="Remove"
          >
            ×
          </button>
        </div>
      {/each}
    {/if}
  </div>

  <div class="add-item">
    <input
      type="text"
      placeholder="Add item..."
      bind:value={newItemTitle}
      on:keydown={handleKeydown}
      class="add-input"
    />
    <button class="add-btn" on:click={addItem} disabled={!newItemTitle.trim()}>
      Add
    </button>
  </div>
</div>

<style>
  .plan-card {
    display: grid;
    gap: 12px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  h4 {
    margin: 4px 0 0 0;
    color: var(--text);
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .plan-list {
    display: grid;
    gap: 8px;
    min-height: 40px;
  }

  .plan-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    cursor: pointer;
  }

  .checkbox-label input {
    cursor: pointer;
  }

  .checkbox-label span {
    color: var(--text);
    font-size: 0.9rem;
  }

  .checkbox-label span.done {
    text-decoration: line-through;
    color: var(--text-muted);
    opacity: 0.7;
  }

  .remove-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background 150ms ease-out, color 150ms ease-out;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    background: var(--surface-0);
    color: var(--text);
  }

  .add-item {
    display: flex;
    gap: 8px;
  }

  .add-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--text);
    font-size: 0.9rem;
  }

  .add-input:focus {
    outline: 2px solid var(--accent);
    border-color: var(--accent);
  }

  .add-btn {
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--accent);
    color: var(--accent-text, white);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease-out;
  }

  .add-btn:hover:not(:disabled) {
    background: var(--accent-hover, var(--accent));
  }

  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

