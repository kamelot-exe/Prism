<script lang="ts">
  import { onMount } from 'svelte';
  import { uiStore } from '../../stores/ui';
  import { settingsStore } from '../../stores/settings';
  import { syncStore } from '../../stores/syncStore';
  import { themeRegistry } from '../../lib/theme/themeRegistry';
  import CategoryManager from './CategoryManager.svelte';
  import CalendarManager from './CalendarManager.svelte';
  import ExportPanel from './ExportPanel.svelte';
  import type { Goal } from '../../lib/productivity/goals';

  let focusMinutes = 25;
  let breakMinutes = 5;
  let autoStartNext = true;
  let weeklyCarry = false;
  let goals: Goal[] = [];
  let editingGoal: Goal | null = null;
  let goalModalOpen = false;
  let goalForm: Partial<Goal> = {
    title: '',
    period: 'week',
    metric: 'tasks_done',
    target: 10,
    enabled: true,
  };

  $: if ($settingsStore.productivity) {
    focusMinutes = $settingsStore.productivity.pomodoroFocus;
    breakMinutes = $settingsStore.productivity.pomodoroBreak;
    autoStartNext = $settingsStore.productivity.pomodoroAutoStart ?? true;
    weeklyCarry = $settingsStore.productivity.weeklyCarry ?? false;
    goals = $settingsStore.productivity.goals || [];
  }

  function handleAutoStartChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    settingsStore.saveSettings({
      productivity: { ...$settingsStore.productivity, pomodoroAutoStart: target.checked },
    });
  }

  function handleFocusChange(e: Event) {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    focusMinutes = value;
    settingsStore.saveSettings({
      productivity: { ...$settingsStore.productivity, pomodoroFocus: value },
    });
  }

  function handleBreakChange(e: Event) {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    breakMinutes = value;
    settingsStore.saveSettings({
      productivity: { ...$settingsStore.productivity, pomodoroBreak: value },
    });
  }

  function handleWeeklyCarryChange(e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    weeklyCarry = checked;
    settingsStore.saveSettings({
      productivity: { ...$settingsStore.productivity, weeklyCarry: checked },
    });
  }

  function openGoalModal(goal?: Goal) {
    if (goal) {
      editingGoal = goal;
      goalForm = { ...goal };
    } else {
      editingGoal = null;
      goalForm = {
        title: '',
        period: 'week',
        metric: 'tasks_done',
        target: 10,
        enabled: true,
      };
    }
    goalModalOpen = true;
  }

  function closeGoalModal() {
    goalModalOpen = false;
    editingGoal = null;
    goalForm = {
      title: '',
      period: 'week',
      metric: 'tasks_done',
      target: 10,
      enabled: true,
    };
  }

  function saveGoal() {
    if (!goalForm.title?.trim()) return;

    const updatedGoals = [...goals];
    
    if (editingGoal) {
      const index = updatedGoals.findIndex((g) => g.id === editingGoal!.id);
      if (index >= 0) {
        updatedGoals[index] = {
          ...editingGoal,
          ...goalForm,
          id: editingGoal.id,
        } as Goal;
      }
    } else {
      const newGoal: Goal = {
        id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: goalForm.title.trim(),
        period: goalForm.period || 'week',
        metric: goalForm.metric || 'tasks_done',
        target: goalForm.target || 10,
        enabled: goalForm.enabled ?? true,
      };
      updatedGoals.push(newGoal);
    }

    settingsStore.saveSettings({
      productivity: {
        ...$settingsStore.productivity,
        goals: updatedGoals,
      },
    });

    closeGoalModal();
  }

  function toggleGoalEnabled(goalId: string) {
    const updatedGoals = goals.map((g) =>
      g.id === goalId ? { ...g, enabled: !g.enabled } : g
    );
    settingsStore.saveSettings({
      productivity: {
        ...$settingsStore.productivity,
        goals: updatedGoals,
      },
    });
  }

  function deleteGoal(goalId: string) {
    const updatedGoals = goals.filter((g) => g.id !== goalId);
    settingsStore.saveSettings({
      productivity: {
        ...$settingsStore.productivity,
        goals: updatedGoals,
      },
    });
  }

  onMount(() => {
    syncStore.checkStatus();
  });
</script>

<section class="settings-shell">
  <header>
    <div>
      <p class="eyebrow">Settings</p>
      <h1>Configure Prism</h1>
      <p class="muted">Set up themes, categories, productivity, and sync.</p>
    </div>
    <button class="ghost" on:click={() => uiStore.setView('calendar')}>Back to calendar</button>
  </header>

  <div class="sections">
    <div class="card placeholder">
      <h2>Themes</h2>
      <div class="theme-list">
        {#each themeRegistry as theme}
          <button
            class:selected={$settingsStore.theme === theme.name}
            on:click={() => settingsStore.setTheme(theme.name)}
          >
            <div class="theme-meta">
              <span>{theme.name}</span>
              {#if $settingsStore.theme === theme.name}
                <small>Active</small>
              {/if}
            </div>
            <span class="apply-text">Apply</span>
          </button>
        {:else}
          <p class="muted">No themes available yet.</p>
        {/each}
      </div>
    </div>
    <div class="card placeholder">
      <h2>Categories</h2>
      <CategoryManager />
    </div>
    <div class="card placeholder">
      <h2>Calendars</h2>
      <CalendarManager />
    </div>
    <div class="card placeholder">
      <h2>Productivity</h2>
      <div class="grid">
        <label>
          <span>Focus minutes</span>
          <input
            type="number"
            min="5"
            value={focusMinutes}
            on:change={handleFocusChange}
          />
        </label>
        <label>
          <span>Break minutes</span>
          <input
            type="number"
            min="1"
            value={breakMinutes}
            on:change={handleBreakChange}
          />
        </label>
        <label class="row">
          <span>Auto start next</span>
          <input
            type="checkbox"
            checked={autoStartNext}
            on:change={handleAutoStartChange}
          />
        </label>
        <label class="row">
          <span>Carry unfinished weekly plan items</span>
          <input
            type="checkbox"
            checked={weeklyCarry}
            on:change={handleWeeklyCarryChange}
          />
        </label>
      </div>

      <div class="goals-section">
        <div class="section-header">
          <h3>Weekly Goals</h3>
          <button class="ghost small" on:click={() => openGoalModal()}>Add Goal</button>
        </div>
        {#if goals.length === 0}
          <p class="muted">No goals set. Add one to track your progress.</p>
        {:else}
          <div class="goals-list">
            {#each goals as goal (goal.id)}
              <div class="goal-row">
                <label class="row">
                  <input
                    type="checkbox"
                    checked={goal.enabled}
                    on:change={() => toggleGoalEnabled(goal.id)}
                  />
                  <div class="goal-info">
                    <strong>{goal.title}</strong>
                    <small>
                      {goal.period} • {goal.metric.replace(/_/g, ' ')} • Target: {goal.target}
                    </small>
                  </div>
                </label>
                <div class="goal-actions">
                  <button class="ghost tiny" on:click={() => openGoalModal(goal)}>Edit</button>
                  <button class="ghost tiny" on:click={() => deleteGoal(goal.id)}>Delete</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if goalModalOpen}
      <div class="modal-backdrop" on:click={closeGoalModal}>
        <div class="modal" on:click|stopPropagation>
          <div class="modal-header">
            <h3>{editingGoal ? 'Edit Goal' : 'Add Goal'}</h3>
            <button class="close-btn" on:click={closeGoalModal}>×</button>
          </div>
          <div class="modal-content">
            <label>
              <span>Title</span>
              <input
                type="text"
                bind:value={goalForm.title}
                placeholder="e.g., Complete 20 tasks"
              />
            </label>
            <label>
              <span>Period</span>
              <select bind:value={goalForm.period}>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </label>
            <label>
              <span>Metric</span>
              <select bind:value={goalForm.metric}>
                <option value="tasks_done">Tasks done</option>
                <option value="focus_tasks_done">Focus tasks done</option>
                <option value="minutes_planned">Minutes planned</option>
              </select>
            </label>
            <label>
              <span>Target</span>
              <input
                type="number"
                min="1"
                bind:value={goalForm.target}
              />
            </label>
            <label class="row">
              <span>Enabled</span>
              <input
                type="checkbox"
                bind:checked={goalForm.enabled}
              />
            </label>
          </div>
          <div class="modal-footer">
            <button class="ghost" on:click={closeGoalModal}>Cancel</button>
            <button class="primary" on:click={saveGoal} disabled={!goalForm.title?.trim()}>
              {editingGoal ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    {/if}
    <div class="card placeholder">
      <h2>Google Sync</h2>
      <div class="status-row">
        <div>
          <p class="status-label">Status</p>
          <p class="status-value">
            {$syncStore.isConnected
              ? `Connected${$syncStore.email ? ` as ${$syncStore.email}` : ''}`
              : 'Not connected'}
          </p>
          <p class="muted small">
            Last sync:
            {$syncStore.lastSyncAt ? new Date($syncStore.lastSyncAt).toLocaleString() : 'Never'}
          </p>
        </div>
        <div class="actions">
          {#if $syncStore.isConnected}
            <button class="secondary" on:click={() => syncStore.syncNow()} disabled={$syncStore.isSyncing}>
              {$syncStore.isSyncing ? 'Syncing...' : 'Sync now'}
            </button>
            <button class="ghost" on:click={() => syncStore.disconnect()} disabled={$syncStore.isSyncing}>
              Disconnect
            </button>
          {:else}
            <button class="primary" on:click={() => syncStore.connect()} disabled={$syncStore.isConnecting}>
              {$syncStore.isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          {/if}
        </div>
      </div>
      {#if $syncStore.error}
        <p class="error-text">{$syncStore.error}</p>
      {/if}
    </div>
    <div class="card placeholder">
      <ExportPanel />
    </div>
  </div>
</section>

<style>
  .settings-shell {
    padding: 16px;
    display: grid;
    gap: 16px;
    color: var(--text);
  }
  header {
    display: flex;
    align-items: flex-start;
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
  h1 {
    margin: 0.15rem 0;
  }
  .muted {
    margin: 0;
    color: var(--text-muted);
  }
  .muted.small {
    font-size: 0.9rem;
  }
  .ghost {
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    padding: 10px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  }
  .ghost:hover {
    background: var(--surface-1);
    border-color: var(--border-light);
    box-shadow: var(--shadow-sm);
  }
  .sections {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }
  .card {
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: var(--shadow-sm);
  }
  .placeholder h2 {
    margin: 0 0 0.35rem 0;
  }
  .placeholder p {
    margin: 0;
    color: var(--text-muted);
  }
  .theme-list {
    display: grid;
    gap: 12px;
    margin-top: 12px;
  }
  .theme-list button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease, transform 120ms ease;
  }
  .theme-list button.selected {
    border-color: var(--accent);
    background: var(--accent-light, var(--surface-0));
    box-shadow: var(--shadow-sm);
  }
  .theme-list button:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
  .theme-meta {
    display: grid;
    gap: 0.2rem;
    text-align: left;
  }
  .theme-meta small {
    color: var(--text-muted);
  }
  .apply-text {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .status-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .status-label {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .status-value {
    margin: 0;
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .primary,
  .secondary,
  .ghost {
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .primary {
    background: var(--accent);
    color: var(--text-on-accent, #fff);
    border: 1px solid var(--accent);
    padding: 10px 14px;
    border-radius: var(--radius-md);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }
  .primary:disabled,
  .secondary:disabled,
  .ghost:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .secondary {
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    padding: 10px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .primary:hover,
  .secondary:hover,
  .ghost:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  .error-text {
    color: var(--error-text, #ff6b6b);
    margin-top: 8px;
    font-size: 0.95rem;
  }
</style>
