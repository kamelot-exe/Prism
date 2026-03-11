<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Task } from '../../lib/api';
  import { tasksStore } from '../../stores/tasksStore';
  import { plannedEventsStore } from '../../stores/plannedEventsStore';
  import { toastStore } from '../../stores/toastStore';
  import { normalizeDate } from '../../lib/dates/safeDate';
  import { autoScheduleTask } from '../../lib/scheduler/autoScheduler';
  import { loadAutoScheduleOptionsForDate, loadTasksForDateRange } from '../../lib/scheduler/schedulerContext';

  export let weekStart: Date = new Date();
  export let selectedDate: Date = new Date();

  let safeWeekStart = new Date();
  $: safeWeekStart = normalizeDate(weekStart);

  let safeSelectedDate = new Date();
  $: safeSelectedDate = normalizeDate(selectedDate);

  let allTasks: Task[] = [];
  let allBlocks: ReturnType<typeof plannedEventsStore.blocksForDate>[] = [];

  function normalizedDate(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10);
  }

  onMount(() => {
    const unsubscribeTasks = tasksStore.subscribe((tasks) => {
      allTasks = tasks;
    });
    const unsubscribeBlocks = plannedEventsStore.subscribe(() => {
      updateBlocks();
    });
    tasksStore.loadAll();
    updateBlocks();
    return () => {
      unsubscribeTasks();
      unsubscribeBlocks();
    };
  });

  function updateBlocks() {
    allBlocks = weekDays.map((day) => plannedEventsStore.blocksForDate(day));
  }

  $: safeWeekStart && (() => {
    updateBlocks();
  })();

  $: weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(safeWeekStart);
    d.setDate(safeWeekStart.getDate() + i);
    return normalizeDate(d);
  });

  $: dayStats = weekDays.map((day) => {
    const dayTasks = allTasks.filter((task) => {
      if (!task.date) return false;
      const taskDate = normalizedDate(task.date);
      const targetDate = normalizedDate(day);
      return taskDate === targetDate;
    });
    const doneTasks = dayTasks.filter((t) => t.done);
    const focusTasks = dayTasks.filter((t) => t.isFocus);
    const doneFocusTasks = focusTasks.filter((t) => t.done);
    return {
      day,
      total: dayTasks.length,
      done: doneTasks.length,
      focusTotal: focusTasks.length,
      focusDone: doneFocusTasks.length,
    };
  });

  $: weekTotals = {
    tasksTotal: dayStats.reduce((sum, s) => sum + s.total, 0),
    tasksDone: dayStats.reduce((sum, s) => sum + s.done, 0),
    focusTotal: dayStats.reduce((sum, s) => sum + s.focusTotal, 0),
    focusDone: dayStats.reduce((sum, s) => sum + s.focusDone, 0),
  };

  $: scheduledMinutes = allBlocks.reduce((sum, dayBlocks) => {
    return sum + dayBlocks.reduce((daySum, block) => {
      const duration = (block.end.getTime() - block.start.getTime()) / (1000 * 60);
      return daySum + duration;
    }, 0);
  }, 0);

  $: scheduledHours = Math.round(scheduledMinutes / 60 * 10) / 10;

  $: topPriorities = allTasks
    .filter((task) => {
      if (task.done) return false;
      if (!task.date) return false;
      const taskDate = normalizedDate(task.date);
      const weekDateStrs = weekDays.map((d) => normalizedDate(d));
      if (!weekDateStrs.includes(taskDate)) return false;
      return task.priority === 'urgent' || task.priority === 'high';
    })
    .filter((task) => {
      if (!task.id) return false;
      const taskDate = normalizedDate(task.date);
      const dayIndex = weekDays.findIndex((d) => normalizedDate(d) === taskDate);
      if (dayIndex === -1) return false;
      const dayBlocks = allBlocks[dayIndex] || [];
      const scheduledTaskIds = new Set(dayBlocks.filter((b) => b.taskId).map((b) => b.taskId as number));
      return !scheduledTaskIds.has(task.id);
    })
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      const aPriority = priorityOrder[a.priority ?? 'normal'] ?? 2;
      const bPriority = priorityOrder[b.priority ?? 'normal'] ?? 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aDuration = a.estimatedMinutes ?? 0;
      const bDuration = b.estimatedMinutes ?? 0;
      return bDuration - aDuration;
    })
    .slice(0, 6);

  async function handleAutoScheduleSelectedDay() {
    const dayTasks = (await loadTasksForDateRange(safeSelectedDate, safeSelectedDate)).filter((task) => !task.done);

    if (dayTasks.length === 0) {
      toastStore.showInfo('No pending tasks for selected day');
      return;
    }

    const existingBlocks = plannedEventsStore.blocksForDate(safeSelectedDate);
    const scheduledTaskIds = new Set(existingBlocks.filter((b) => b.taskId).map((b) => b.taskId as number));

    const unscheduledTasks = dayTasks
      .filter((task) => {
        if (!task.id) return false;
        return !scheduledTaskIds.has(task.id);
      })
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
        const aPriority = priorityOrder[a.priority ?? 'normal'] ?? 2;
        const bPriority = priorityOrder[b.priority ?? 'normal'] ?? 2;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const aDuration = a.estimatedMinutes ?? 0;
        const bDuration = b.estimatedMinutes ?? 0;
        return bDuration - aDuration;
      });

    if (unscheduledTasks.length === 0) {
      toastStore.showInfo('All tasks for selected day are already scheduled');
      return;
    }

    let scheduled = 0;
    let failed = 0;
    const currentBlocks = [...existingBlocks];
    const options = await loadAutoScheduleOptionsForDate(safeSelectedDate);

    for (const task of unscheduledTasks) {
      const plannedEvent = autoScheduleTask(task, safeSelectedDate, currentBlocks, options);
      if (plannedEvent) {
        try {
          await plannedEventsStore.addBlock(plannedEvent);
          currentBlocks.push({ ...plannedEvent, id: 'temp' });
          scheduled++;
        } catch {
          failed++;
        }
      } else {
        failed++;
      }
    }

    if (scheduled > 0) {
      toastStore.showSuccess(
        `Scheduled ${scheduled} task${scheduled !== 1 ? 's' : ''} for selected day${failed > 0 ? `. ${failed} could not be scheduled` : ''}`
      );
    } else {
      toastStore.showError('No free time slots available for selected day');
    }
  }
</script>

<div class="week-review">
  <div class="header">
    <p class="eyebrow">Week Review</p>
    <h3>
      {safeWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
      {new Date(safeWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
    </h3>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">{weekTotals.tasksDone}/{weekTotals.tasksTotal}</div>
      <div class="stat-label">Tasks</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{weekTotals.focusDone}/{weekTotals.focusTotal}</div>
      <div class="stat-label">Focus</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{scheduledHours}h</div>
      <div class="stat-label">Scheduled</div>
    </div>
  </div>

  {#if topPriorities.length > 0}
    <div class="section">
      <div class="section-header">
        <h4 class="section-title">Top Priorities</h4>
      </div>
      <div class="priorities-list">
        {#each topPriorities as task (task.id || task.title + task.date)}
          <div class="priority-item" transition:fade={{ duration: 150 }}>
            <span class="priority-title">{task.title}</span>
            <span class="priority-badge priority-{task.priority}">{task.priority}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="actions-section">
    <button class="btn-primary" on:click={handleAutoScheduleSelectedDay}>
      Auto-schedule for selected day
    </button>
  </div>
</div>

<style>
  .week-review {
    display: grid;
    gap: 16px;
    padding: 16px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: 16px;
  }

  .header {
    display: grid;
    gap: 4px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stat-card {
    display: grid;
    gap: 4px;
    padding: 12px;
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section {
    display: grid;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .section-title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
  }

  .priorities-list {
    display: grid;
    gap: 6px;
  }

  .priority-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
  }

  .priority-title {
    flex: 1;
    color: var(--text);
  }

  .priority-badge {
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .priority-badge.priority-urgent {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .priority-badge.priority-high {
    background: rgba(251, 146, 60, 0.15);
    color: #fb923c;
  }

  .actions-section {
    padding-top: 12px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: center;
  }

  .btn-primary {
    padding: 8px 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-text, white);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 150ms ease-out, opacity 150ms ease-out;
  }

  .btn-primary:hover {
    background: var(--accent-hover, var(--accent));
    opacity: 0.9;
  }

  .btn-primary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .priority-item {
      transition: none;
    }
  }
</style>

