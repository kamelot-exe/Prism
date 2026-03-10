<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { settingsStore } from '../../stores/settings';
  import { tasksStore } from '../../stores/tasksStore';
  import { plannedEventsStore } from '../../stores/plannedEventsStore';
  import type { Goal, WeeklyMetrics, GoalProgress } from '../../lib/productivity/goals';
  import { computeWeeklyMetrics, computeGoalProgress } from '../../lib/productivity/goals';
  import { normalizeDate } from '../../lib/dates/safeDate';

  export let currentDate: Date = new Date();

  let goals: Goal[] = [];
  let tasks: typeof tasksStore extends { subscribe: (v: (val: infer T) => void) => void } ? T : never = [];
  let plannedBlocks: typeof plannedEventsStore extends { subscribe: (v: (val: infer T) => void) => void } ? T : never = [];
  let metrics: WeeklyMetrics = { tasks_done: 0, focus_tasks_done: 0, minutes_planned: 0 };

  let unsubscribeSettings: (() => void) | null = null;
  let unsubscribeTasks: (() => void) | null = null;
  let unsubscribeBlocks: (() => void) | null = null;

  onMount(() => {
    unsubscribeSettings = settingsStore.subscribe((settings) => {
      goals = settings.productivity?.goals || [];
    });
    unsubscribeTasks = tasksStore.subscribe((ts) => {
      tasks = ts;
    });
    unsubscribeBlocks = plannedEventsStore.subscribe((blocks) => {
      plannedBlocks = blocks;
    });
  });

  onDestroy(() => {
    unsubscribeSettings?.();
    unsubscribeTasks?.();
    unsubscribeBlocks?.();
  });

  $: {
    const safeDate = normalizeDate(currentDate);
    metrics = computeWeeklyMetrics(safeDate, tasks, plannedBlocks);
  }

  $: enabledGoals = goals.filter((g) => g.enabled && g.period === 'week');

  function getProgress(goal: Goal): GoalProgress {
    return computeGoalProgress(goal, metrics);
  }

  function formatMetricValue(goal: Goal, value: number): string {
    if (goal.metric === 'minutes_planned') {
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }
    return value.toString();
  }
</script>

<div class="goals-card">
  <div class="card-header">
    <div>
      <p class="eyebrow">Weekly Goals</p>
      <h4>Progress tracking</h4>
    </div>
  </div>

  {#if enabledGoals.length === 0}
    <div class="empty-state">
      <p class="muted">No goals set</p>
      <p class="hint">Add goals in Settings → Productivity</p>
    </div>
  {:else}
    <div class="goals-list">
      {#each enabledGoals as goal (goal.id)}
        {@const progress = getProgress(goal)}
        <div class="goal-item">
          <div class="goal-header">
            <span class="goal-title">{goal.title}</span>
            <span class="goal-value">
              {formatMetricValue(goal, progress.value)} / {formatMetricValue(goal, progress.target)}
            </span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: {Math.min(100, progress.pct)}%;"></div>
          </div>
          <div class="goal-footer">
            <span class="goal-pct">{Math.round(progress.pct)}%</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .goals-card {
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
  }

  .empty-state {
    padding: 24px;
    text-align: center;
  }

  .muted {
    color: var(--text-muted);
    margin: 0 0 4px 0;
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin: 0;
    opacity: 0.7;
  }

  .goals-list {
    display: grid;
    gap: 12px;
  }

  .goal-item {
    display: grid;
    gap: 8px;
    padding: 12px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .goal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .goal-title {
    font-weight: 600;
    color: var(--text);
    font-size: 0.9rem;
  }

  .goal-value {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .progress-bar-container {
    height: 6px;
    background: var(--surface-0);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-sm);
    transition: width 300ms ease-out;
  }

  .goal-footer {
    display: flex;
    justify-content: flex-end;
  }

  .goal-pct {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>

