<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import type { Task } from '../../lib/api';
  import { tasksStore } from '../../stores/tasksStore';
  import { plannedEventsStore } from '../../stores/plannedEventsStore';
  import { toastStore } from '../../stores/toastStore';
  import { getWeekRange, calculateWeeklyStats, type WeeklyStats } from '../../lib/review/weeklyStats';
  import { normalizeDate } from '../../lib/dates/safeDate';

  export let currentDate: Date = new Date();

  let stats: WeeklyStats | null = null;
  let weekRange = getWeekRange(currentDate);
  let safeDate = new Date();
  $: safeDate = normalizeDate(currentDate);
  $: weekRange = getWeekRange(safeDate);

  function normalizedDate(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10);
  }

  function formatDateRange(range: { start: Date; end: Date }): string {
    const startStr = range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }

  function calculateStats() {
    const allTasks = get(tasksStore);
    const allBlocks = get(plannedEventsStore);
    stats = calculateWeeklyStats(allTasks, allBlocks, weekRange);
  }

  let unsubscribeTasks: (() => void) | null = null;
  let unsubscribeBlocks: (() => void) | null = null;

  onMount(() => {
    unsubscribeTasks = tasksStore.subscribe(() => {
      calculateStats();
    });
    unsubscribeBlocks = plannedEventsStore.subscribe(() => {
      calculateStats();
    });
    calculateStats();
  });

  onDestroy(() => {
    unsubscribeTasks?.();
    unsubscribeBlocks?.();
  });

  $: safeDate && calculateStats();

  async function moveToNextWeek(task: Task) {
    if (!task.id) return;
    
    const nextWeekStart = new Date(weekRange.end);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeekDate = normalizedDate(nextWeekStart);
    
    try {
      await tasksStore.updateTask(task.id, { date: nextWeekDate });
      toastStore.showSuccess(`"${task.title}" moved to next week`);
    } catch (err) {
      console.error('Failed to move task', err);
      toastStore.showError('Could not move task');
    }
  }

  async function markObsolete(task: Task) {
    if (!task.id) return;
    
    try {
      await tasksStore.toggle(task.id, true);
      toastStore.showSuccess(`"${task.title}" marked as done`);
    } catch (err) {
      console.error('Failed to mark task obsolete', err);
      toastStore.showError('Could not mark task');
    }
  }

  function getCompletionRate(total: number, completed: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }
</script>

<div class="weekly-review">
  <div class="header">
    <div>
      <p class="eyebrow">Weekly Review</p>
      <h2>{formatDateRange(weekRange)}</h2>
    </div>
  </div>

  {#if stats}
    <!-- Stats Section -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-value">{stats.totalTasks}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.completedTasks}</div>
        <div class="stat-label">Completed</div>
        {#if stats.totalTasks > 0}
          <div class="stat-percent">{getCompletionRate(stats.totalTasks, stats.completedTasks)}%</div>
        {/if}
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.focusTasksCompleted}</div>
        <div class="stat-label">Focus Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.completedPlannedBlocks}</div>
        <div class="stat-label">of {stats.totalPlannedBlocks} Planned</div>
        {#if stats.totalPlannedBlocks > 0}
          <div class="stat-percent">{getCompletionRate(stats.totalPlannedBlocks, stats.completedPlannedBlocks)}%</div>
        {/if}
      </div>
    </div>

    <!-- Completed This Week -->
    {#if stats.completedThisWeek.length > 0}
      <div class="section">
        <h3 class="section-title">Completed This Week</h3>
        <div class="task-list">
          {#each stats.completedThisWeek as task}
            <div class="task-item completed">
              <span class="task-check">✓</span>
              <span class="task-title">{task.title}</span>
              {#if task.isFocus}
                <span class="task-badge focus">Focus</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Planned But Not Completed -->
    {#if stats.plannedButNotCompleted.length > 0}
      <div class="section">
        <h3 class="section-title">Planned But Not Completed</h3>
        <div class="task-list">
          {#each stats.plannedButNotCompleted as task}
            <div class="task-item">
              <span class="task-title">{task.title}</span>
              <div class="task-actions">
                <button class="action-btn" on:click={() => moveToNextWeek(task)} title="Move to next week">
                  Move to next week
                </button>
                <button class="action-btn" on:click={() => markObsolete(task)} title="Mark as done">
                  Mark obsolete
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Never Scheduled -->
    {#if stats.neverScheduled.length > 0}
      <div class="section">
        <h3 class="section-title">Never Scheduled</h3>
        <p class="section-hint">Tasks that were never added to your schedule</p>
        <div class="task-list">
          {#each stats.neverScheduled as task}
            <div class="task-item">
              <span class="task-title">{task.title}</span>
              <div class="task-actions">
                <button class="action-btn" on:click={() => moveToNextWeek(task)} title="Move to next week">
                  Move to next week
                </button>
                <button class="action-btn" on:click={() => markObsolete(task)} title="Mark as done">
                  Mark obsolete
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Empty State -->
    {#if stats.completedThisWeek.length === 0 && stats.plannedButNotCompleted.length === 0 && stats.neverScheduled.length === 0}
      <div class="empty-state">
        <p class="muted">No tasks for this week</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .weekly-review {
    display: grid;
    gap: 20px;
    padding: 20px;
    background: var(--surface-0);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
  }

  .header {
    display: grid;
    gap: 4px;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text);
    font-weight: 600;
  }

  .stats-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    padding: 16px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .stat-card {
    display: grid;
    gap: 4px;
    text-align: center;
    padding: 12px;
    background: var(--surface-1);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .stat-value {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-percent {
    font-size: 0.75rem;
    color: var(--accent);
    font-weight: 600;
    margin-top: 2px;
  }

  .section {
    display: grid;
    gap: 12px;
    padding-top: 16px;
  }

  .section-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .section-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .task-list {
    display: grid;
    gap: 8px;
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--surface-1);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    transition: background 140ms ease, border-color 140ms ease;
  }

  .task-item:hover {
    background: var(--surface-0);
    border-color: var(--border-light);
  }

  .task-item.completed {
    opacity: 0.7;
  }

  .task-check {
    font-size: 1rem;
    color: var(--accent);
    flex-shrink: 0;
  }

  .task-title {
    flex: 1;
    color: var(--text);
    font-size: 0.9rem;
  }

  .task-item.completed .task-title {
    text-decoration: line-through;
  }

  .task-badge {
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .task-badge.focus {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }

  .task-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .action-btn {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-0);
    color: var(--text);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease;
  }

  .action-btn:hover {
    background: var(--surface-1);
    border-color: var(--accent);
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
  }

  .muted {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
</style>

