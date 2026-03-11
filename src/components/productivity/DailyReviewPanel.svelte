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

  export let selectedDate: Date = new Date();

  let safeDate = new Date();
  $: safeDate = normalizeDate(selectedDate);

  let allTasks: Task[] = [];
  let allBlocks: ReturnType<typeof plannedEventsStore.blocksForDate> = [];

  onMount(() => {
    const unsubscribeTasks = tasksStore.subscribe((tasks) => {
      allTasks = tasks;
    });
    const unsubscribeBlocks = plannedEventsStore.subscribe(() => {
      allBlocks = plannedEventsStore.blocksForDate(safeDate);
    });
    const autoScheduleHandler = () => {
      handleAutoScheduleTopTasks();
    };
    window.addEventListener('auto-schedule-selected-day', autoScheduleHandler);
    tasksStore.loadAll();
    allBlocks = plannedEventsStore.blocksForDate(safeDate);
    return () => {
      unsubscribeTasks();
      unsubscribeBlocks();
      window.removeEventListener('auto-schedule-selected-day', autoScheduleHandler);
    };
  });

  $: safeDate && (allBlocks = plannedEventsStore.blocksForDate(safeDate));

  $: dateTasks = allTasks.filter((task) => {
    if (!task.date) return false;
    const taskDate = normalizeDate(task.date);
    const targetDate = normalizeDate(safeDate);
    return taskDate.getTime() === targetDate.getTime();
  });

  $: focusTasks = dateTasks.filter((t) => t.isFocus && !t.done);
  $: focusTasksDisplay = focusTasks.slice(0, 3);

  $: scheduledTaskIds = new Set(
    allBlocks.filter((b) => b.taskId).map((b) => b.taskId as number)
  );

  $: unscheduledUrgentHigh = dateTasks
    .filter((task) => {
      if (task.done) return false;
      if (!task.id) return false;
      if (scheduledTaskIds.has(task.id)) return false;
      return task.priority === 'urgent' || task.priority === 'high';
    })
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      const aPriority = priorityOrder[a.priority ?? 'normal'] ?? 2;
      const bPriority = priorityOrder[b.priority ?? 'normal'] ?? 2;
      return aPriority - bPriority;
    })
    .slice(0, 5);

  $: scheduledMinutes = allBlocks.reduce((sum, block) => {
    const duration = (block.end.getTime() - block.start.getTime()) / (1000 * 60);
    return sum + duration;
  }, 0);

  $: scheduledHours = Math.round((scheduledMinutes / 60) * 10) / 10;
  $: isTightDay = scheduledMinutes > 480 || allBlocks.length > 10;
  $: isEmpty = dateTasks.length === 0 && allBlocks.length === 0;

  async function handleAutoScheduleTopTasks() {
    const freshTasks = await loadTasksForDateRange(safeDate, safeDate);
    const dayScheduledTaskIds = new Set(plannedEventsStore.blocksForDate(safeDate).filter((b) => b.taskId).map((b) => b.taskId as number));
    const candidateTasks = freshTasks
      .filter((task) => !task.done)
      .filter((task) => task.priority === 'urgent' || task.priority === 'high')
      .filter((task) => task.id && !dayScheduledTaskIds.has(task.id))
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
        const aPriority = priorityOrder[a.priority ?? 'normal'] ?? 2;
        const bPriority = priorityOrder[b.priority ?? 'normal'] ?? 2;
        return aPriority - bPriority;
      })
      .slice(0, 5);

    if (candidateTasks.length === 0) {
      toastStore.showInfo('No unscheduled urgent or high priority tasks');
      return;
    }

    let scheduled = 0;
    let failed = 0;
    const existingBlocks = plannedEventsStore.blocksForDate(safeDate);
    const options = await loadAutoScheduleOptionsForDate(safeDate);

    for (const task of candidateTasks) {
      const plannedEvent = autoScheduleTask(task, safeDate, existingBlocks, options);
      if (plannedEvent) {
        try {
          await plannedEventsStore.addBlock(plannedEvent);
          existingBlocks.push({ ...plannedEvent, id: 'temp' });
          scheduled += 1;
        } catch {
          failed += 1;
        }
      } else {
        failed += 1;
      }
    }

    if (scheduled > 0) {
      toastStore.showSuccess(
        `Scheduled ${scheduled} task${scheduled !== 1 ? 's' : ''}${failed > 0 ? `. ${failed} could not be scheduled` : ''}`
      );
    } else {
      toastStore.showError('No free time slots available');
    }
  }

  async function handleScheduleTask(task: Task) {
    if (!task.id) return;

    const existingBlocks = plannedEventsStore.blocksForDate(safeDate);
    const options = await loadAutoScheduleOptionsForDate(safeDate);
    const plannedEvent = autoScheduleTask(task, safeDate, existingBlocks, options);

    if (!plannedEvent) {
      toastStore.showError('No free time slots available for this task');
      return;
    }

    try {
      await plannedEventsStore.addBlock(plannedEvent);
    } catch (err) {
      toastStore.showError(err instanceof Error ? err.message : 'Could not create planned block');
      return;
    }
    toastStore.showSuccess(
      `"${task.title}" scheduled for ${new Date(plannedEvent.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
  }

  async function handlePinAsFocus(task: Task) {
    if (!task.id) return;

    try {
      await tasksStore.updateTask(task.id, { isFocus: true });
      toastStore.showSuccess(`"${task.title}" pinned as focus task`);
    } catch (err) {
      console.error('Failed to pin task as focus', err);
      toastStore.showError('Could not pin task');
    }
  }

  async function handleClearDayBlocks() {
    if (!confirm('Clear all planned blocks for this day? Tasks and events will not be deleted.')) {
      return;
    }

    await plannedEventsStore.clearForDate(safeDate);
    toastStore.showSuccess('Planned blocks cleared');
  }

  function handleCreateTask() {
    window.dispatchEvent(new CustomEvent('focus-task-input'));
  }
</script>

<div class="daily-review">
  <div class="header">
    <p class="eyebrow">Day Plan</p>
    <h3>{safeDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
  </div>

  {#if isEmpty}
    <div class="empty-state">
      <p class="empty-message">Nothing is planned for this day yet.</p>
      <div class="empty-actions">
        <button class="btn-primary" on:click={handleCreateTask}>Create task</button>
        <button class="btn-secondary" on:click={handleAutoScheduleTopTasks} disabled={unscheduledUrgentHigh.length === 0}>
          Plan urgent tasks
        </button>
      </div>
    </div>
  {:else}
    {#if isTightDay}
      <p class="tight-hint">This day is already dense. Review blocks before planning more work.</p>
    {/if}

    {#if focusTasks.length > 0}
      <div class="section">
        <div class="section-header">
          <h4 class="section-title">Focus Tasks</h4>
          <span class="section-count">{focusTasks.length}</span>
        </div>
        <div class="task-list">
          {#each focusTasksDisplay as task (task.id)}
            <div class="task-item focus" transition:fade={{ duration: 150 }}>
              <span class="task-title">{task.title}</span>
              {#if task.priority === 'urgent' || task.priority === 'high'}
                <span class="priority-indicator priority-{task.priority}"></span>
              {/if}
            </div>
          {/each}
          {#if focusTasks.length > 3}
            <p class="more-indicator">+{focusTasks.length - 3} more</p>
          {/if}
        </div>
      </div>
    {/if}

    {#if allBlocks.length > 0}
      <div class="section">
        <div class="section-header">
          <h4 class="section-title">Planned blocks</h4>
          <span class="section-count">{allBlocks.length} blocks</span>
        </div>
        <p class="section-meta">{scheduledHours}h planned</p>
      </div>
    {/if}

    {#if unscheduledUrgentHigh.length > 0}
      <div class="section">
        <div class="section-header">
          <h4 class="section-title">Ready to plan</h4>
          <button class="btn-link" on:click={handleAutoScheduleTopTasks}>
            Plan urgent tasks
          </button>
        </div>
        <div class="task-list">
          {#each unscheduledUrgentHigh as task (task.id)}
            <div class="task-item actionable" transition:fade={{ duration: 150 }}>
              <span class="task-title">{task.title}</span>
              <span class="priority-badge priority-{task.priority}">{task.priority}</span>
              <div class="task-quick-actions">
                <button
                  class="action-btn"
                  on:click={() => handleScheduleTask(task)}
                  title="Plan task"
                  aria-label="Plan {task.title}"
                >
                  Plan
                </button>
                <button
                  class="action-btn"
                  on:click={() => handlePinAsFocus(task)}
                  title="Mark as focus"
                  aria-label="Mark {task.title} as focus"
                >
                  Mark focus
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if allBlocks.length > 0}
      <div class="actions-section">
        <button class="btn-clear" on:click={handleClearDayBlocks}>
          Clear planned blocks
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .daily-review {
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

  .empty-state {
    display: grid;
    gap: 12px;
    padding: 24px;
    text-align: center;
  }

  .empty-message {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .empty-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
  }

  .btn-primary,
  .btn-secondary,
  .btn-link,
  .btn-clear {
    padding: 8px 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-0);
    color: var(--text);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 150ms ease-out, border-color 150ms ease-out;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--accent-text, white);
    border-color: var(--accent);
  }

  .btn-primary:hover {
    background: var(--accent-hover, var(--accent));
    opacity: 0.9;
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-1);
    border-color: var(--border-light);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-link {
    border: none;
    background: transparent;
    color: var(--accent);
    padding: 4px 8px;
    font-size: 0.8rem;
    text-decoration: underline;
  }

  .btn-link:hover {
    color: var(--accent-hover, var(--accent));
  }

  .btn-clear {
    background: transparent;
    color: var(--text-muted);
    border-color: var(--border);
  }

  .btn-clear:hover {
    background: var(--surface-0);
    color: var(--text);
  }

  .tight-hint {
    margin: 0 0 12px 0;
    padding: 8px 12px;
    background: rgba(251, 146, 60, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.3);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.85rem;
    text-align: center;
  }

  .section {
    display: grid;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .section:first-of-type {
    border-top: none;
    padding-top: 0;
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

  .section-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .section-meta {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .task-list {
    display: grid;
    gap: 6px;
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
  }

  .task-item.focus {
    border-left: 3px solid var(--accent);
  }

  .task-item.actionable {
    padding: 10px;
  }

  .task-title {
    flex: 1;
    color: var(--text);
  }

  .priority-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .priority-indicator.priority-urgent {
    background: #ef4444;
  }

  .priority-indicator.priority-high {
    background: #fb923c;
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

  .task-quick-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .action-btn {
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 150ms ease-out, border-color 150ms ease-out;
  }

  .action-btn:hover {
    background: var(--surface-0);
    border-color: var(--accent);
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .more-indicator {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding: 4px;
  }

  .actions-section {
    padding-top: 12px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .task-item {
      transition: none;
    }
  }
</style>





