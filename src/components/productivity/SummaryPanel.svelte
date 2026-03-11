<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { tweened } from 'svelte/motion';
  import { normalizeDate } from '../../lib/dates/safeDate';
  import { getSummaryForDate } from '../../stores/summaryStore';
  import { eventsStore } from '../../stores/eventsStore';
  import { tasksStore } from '../../stores/tasksStore';
  import { pomodoroStore } from '../../stores/pomodoroStore';
  import { suggestionsStore } from '../../stores/suggestionsStore';
  import { scheduleStore } from '../../stores/scheduleStore';
  import { get } from 'svelte/store';
  import { listFocusSessionsRange, type FocusSessionRecord } from '../../lib/api';

  export let selectedDate: Date | string | null | undefined = new Date();

  // Normalize date immediately using our helper
  $: safeDate = normalizeDate(selectedDate);

  // Track store updates for reactivity
  let storeVersion = 0;
  let unsubscribeEvents: (() => void) | null = null;
  let unsubscribeTasks: (() => void) | null = null;
  let unsubscribePomodoro: (() => void) | null = null;
  let unsubscribeSuggestions: (() => void) | null = null;
  let unsubscribeSchedule: (() => void) | null = null;
  let suggestions: any[] = [];
  let scheduleBlocks: any[] = [];
  let trackedFocusSessions: FocusSessionRecord[] = [];

  onMount(() => {
    // Subscribe to stores to trigger reactivity
    unsubscribeEvents = eventsStore.subscribe(() => {
      storeVersion++;
    });
    unsubscribeTasks = tasksStore.subscribe(() => {
      storeVersion++;
    });
    unsubscribePomodoro = pomodoroStore.todaySessions.subscribe(() => {
      storeVersion++;
    });
    
    // Subscribe to suggestions
    unsubscribeSuggestions = suggestionsStore.suggestions.subscribe((s) => {
      suggestions = s;
    });
    
    // Subscribe to schedule
    unsubscribeSchedule = scheduleStore.subscribe((blocks) => {
      scheduleBlocks = blocks;
    });
    
    // Load today's pomodoro sessions
    pomodoroStore.loadTodaySessions(safeDate);
    loadTrackedFocusSessions();
  });

  onDestroy(() => {
    unsubscribeEvents?.();
    unsubscribeTasks?.();
    unsubscribePomodoro?.();
    unsubscribeSuggestions?.();
    unsubscribeSchedule?.();
  });

  $: focusTasks = (tasksStore.focusTasksForDate && tasksStore.focusTasksForDate(safeDate)) || [];
  $: focusTasksTotal = focusTasks.length;
  $: focusTasksDone = focusTasks.filter((t) => t.done).length;

  // Reactive summary data - always defined
  // Recomputes when safeDate or storeVersion changes
  $: summary = getSummaryForDate(safeDate);
  $: safeDate, loadTrackedFocusSessions();

  // Animated progress values
  const progressPercent = tweened(0, { duration: 300, easing: (t) => t * (2 - t) });
  const focusTasksProgress = tweened(0, { duration: 300, easing: (t) => t * (2 - t) });
  const focusScore = tweened(0, { duration: 400, easing: (t) => t * (2 - t) });

  $: {
    const newProgress = summary.stats.total > 0
      ? Math.round((summary.stats.done / summary.stats.total) * 100)
      : 0;
    progressPercent.set(newProgress);
  }

  $: {
    const newFocusProgress = focusTasksTotal > 0 ? Math.round((focusTasksDone / focusTasksTotal) * 100) : 0;
    focusTasksProgress.set(newFocusProgress);
  }

  $: {
    const completedTasks = summary.completedTasks.length;
    const urgentOrHighDone = summary.completedTasks.filter(
      (t) => t.priority === 'urgent' || t.priority === 'high'
    ).length;
    
    const score = Math.min(
      100,
      focusMinutes * 2 + completedTasks * 5 + urgentOrHighDone * 8
    );
    focusScore.set(score);
  }
  
  // Refresh suggestions when data changes
  $: if (safeDate) {
    suggestionsStore.refreshSuggestions(safeDate);
  }


  async function loadTrackedFocusSessions() {
    const start = new Date(safeDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(safeDate);
    end.setHours(23, 59, 59, 999);
    try {
      trackedFocusSessions = await listFocusSessionsRange(start.toISOString(), end.toISOString());
    } catch (err) {
      console.error('[SummaryPanel] Failed to load focus sessions', err);
      trackedFocusSessions = [];
    }
  }

  // Date label for display
  $: dateLabel = safeDate.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  // Format time for events
  function formatTime(isoString: string): string {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }


  // Check if there's any content
  $: hasContent =
    summary.tasks.length > 0 || summary.events.length > 0;

  // Calculate priority statistics
  $: priorityStats = (() => {
    const stats = { urgent: 0, high: 0, normal: 0, low: 0 };
    for (const task of summary.tasks) {
      const p = task.priority ?? 'normal';
      if (p === 'urgent') stats.urgent++;
      else if (p === 'high') stats.high++;
      else if (p === 'normal') stats.normal++;
      else if (p === 'low') stats.low++;
    }
    return stats;
  })();

  // Get tasks added automatically today (via NLP)
  $: autoAddedTasks = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return summary.tasks.filter((task) => {
      if (!task.created_at) return false;
      const created = new Date(task.created_at);
      created.setHours(0, 0, 0, 0);
      return created.getTime() === today.getTime();
    });
  })();

  // Pomodoro statistics
  let todaySessionsList: any[] = [];
  $: todaySessionsList = get(pomodoroStore.todaySessions) || [];
  $: pomodoroFocusSessions = todaySessionsList.filter((s: any) => s.kind === 'focus' && s.completed);
  $: focusSessions = trackedFocusSessions;
  $: totalTrackedFocusSessions = pomodoroFocusSessions.length + focusSessions.length;
  $: focusMinutes = pomodoroFocusSessions.reduce((sum: number, s: any) => sum + s.durationMinutes, 0) + focusSessions.reduce((sum: number, s: FocusSessionRecord) => sum + (s.durationMinutes ?? 0), 0);
  $: breakMinutes = todaySessionsList
    .filter((s: any) => s.kind === 'break' && s.completed)
    .reduce((sum: number, s: any) => sum + s.durationMinutes, 0);

</script>

<div class="summary">
  <div class="header">
    <p class="eyebrow">Summary</p>
    <h4>{dateLabel}</h4>
  </div>

  {#if !hasContent}
    <div class="empty-state">
      <p class="muted">Nothing planned today</p>
    </div>
  {:else}
    <!-- Suggestions Section -->
    {#if suggestions.length > 0}
      <div class="section suggestions-section">
        <h5 class="section-title">Suggestions</h5>
        <div class="suggestions-list">
          {#each suggestions as suggestion}
            <p class="suggestion suggestion-{suggestion.type}" transition:fade={{ duration: 150 }}>
              {suggestion.message}
            </p>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Schedule Status Section -->
    <div class="section schedule-status-section">
      <p class="data-note">Schedule metrics use visible suggested blocks. Actual focus metrics combine tracked Pomodoro focus sessions and tracked focus sessions; untracked work is still excluded.</p>
      {#if scheduleBlocks.length > 0}
        <p class="schedule-status">
          <span class="schedule-indicator">✓</span>
          Suggested schedule generated ({scheduleBlocks.length} block{scheduleBlocks.length !== 1 ? 's' : ''})
        </p>
      {:else}
        <p class="schedule-status muted">
          <span class="schedule-cta">Generate schedule for this day in the Day view</span>
        </p>
      {/if}
    </div>

    <!-- Overview Section -->
    <div class="section">
      <h5 class="section-title">Overview</h5>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-value">{summary.stats.total}</span>
          <span class="stat-label">Tasks</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{summary.stats.done}</span>
          <span class="stat-label">Completed</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{summary.events.length}</span>
          <span class="stat-label">Events</span>
        </div>
      </div>
      {#if summary.stats.total > 0}
        <div class="progress-container">
          <div class="progress-bar" style="width: {$progressPercent}%"></div>
        </div>
        <p class="progress-text">{$progressPercent}% complete</p>
      {/if}
    </div>

    <!-- Priority Statistics Section -->
    {#if summary.tasks.length > 0}
      <div class="section">
        <h5 class="section-title">Priority</h5>
        <div class="priority-stats">
          {#if priorityStats.urgent > 0}
            <div class="priority-stat-item urgent">
              <span class="priority-icon">🔥</span>
              <span class="priority-count">{priorityStats.urgent}</span>
              <span class="priority-label">urgent</span>
            </div>
          {/if}
          {#if priorityStats.high > 0}
            <div class="priority-stat-item high">
              <span class="priority-icon">⬆️</span>
              <span class="priority-count">{priorityStats.high}</span>
              <span class="priority-label">high</span>
            </div>
          {/if}
          {#if priorityStats.normal > 0}
            <div class="priority-stat-item normal">
              <span class="priority-icon">➖</span>
              <span class="priority-count">{priorityStats.normal}</span>
              <span class="priority-label">normal</span>
            </div>
          {/if}
          {#if priorityStats.low > 0}
            <div class="priority-stat-item low">
              <span class="priority-icon">⬇️</span>
              <span class="priority-count">{priorityStats.low}</span>
              <span class="priority-label">low</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Focus Section -->
    <div class="section">
      <h5 class="section-title">Focus</h5>
      <div class="focus-stats">
        <div class="focus-stat-item">
          <span class="focus-value">{totalTrackedFocusSessions}</span>
          <span class="focus-label">focus sessions</span>
        </div>
        <div class="focus-stat-item">
          <span class="focus-value">{focusMinutes}</span>
          <span class="focus-label">focus minutes</span>
        </div>
        {#if breakMinutes > 0}
          <div class="focus-stat-item">
            <span class="focus-value">{breakMinutes}</span>
            <span class="focus-label">break minutes</span>
          </div>
        {/if}
      </div>
      {#if focusTasksTotal > 0}
        <div class="focus-tasks-stats">
          <div class="focus-tasks-item">
            <span class="focus-tasks-value">{focusTasksDone}</span>/<span class="focus-tasks-total">{focusTasksTotal}</span>
            <span class="focus-tasks-label">focus tasks</span>
          </div>
          <div class="focus-tasks-progress">
            <div class="focus-tasks-progress-bar" style="width: {$focusTasksProgress}%"></div>
          </div>
          <span class="focus-tasks-percent">{$focusTasksProgress}%</span>
        </div>
      {/if}
      
      <!-- Focus Score -->
      <div class="focus-score-container">
        <div class="focus-score-header">
          <span class="focus-score-label">Daily Focus Score</span>
          <span class="focus-score-value">{$focusScore}</span>
        </div>
        <div class="focus-score-bar">
          <div class="focus-score-fill" style="width: {$focusScore}%"></div>
        </div>
      </div>
    </div>

    <!-- Added Automatically Section -->
    {#if autoAddedTasks.length > 0}
      <div class="section auto-added-section">
        <h5 class="section-title">Added Automatically</h5>
        <div class="task-list">
          {#each autoAddedTasks as task}
            <div class="task-item auto-added">
              <span class="task-checkbox">○</span>
              <span class="task-title">{task.title}</span>
              {#if task.recurrence}
                <span class="recurrence-icon" title="Recurring task">↻</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Tasks Section -->
    {#if summary.tasks.length > 0}
      <div class="section">
        <h5 class="section-title">Tasks</h5>
        <div class="task-list">
          {#each summary.pendingTasks as task}
            <div class="task-item pending">
              <span class="task-checkbox">○</span>
              <span class="task-title">{task.title}</span>
            </div>
          {/each}
          {#each summary.completedTasks as task}
            <div class="task-item completed">
              <span class="task-checkbox">✓</span>
              <span class="task-title">{task.title}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Events Section -->
    {#if summary.events.length > 0}
      <div class="section">
        <h5 class="section-title">Events</h5>
        <div class="event-list">
          {#each summary.events as event}
            <div class="event-item">
              <div class="event-time">
                {formatTime(event.start_time)}
                {#if event.end_time && event.start_time !== event.end_time}
                  <span class="time-separator">–</span>
                  {formatTime(event.end_time)}
                {/if}
              </div>
              <div class="event-title">{event.title}</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .summary {
    display: grid;
    gap: 14px;
    padding: 14px;
    border-radius: var(--radius-md);
    background: var(--surface-1);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-xs);
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

  h4 {
    margin: 0;
    font-size: 1rem;
    color: var(--text);
    font-weight: 600;
  }

  .empty-state {
    padding: 20px 0;
    text-align: center;
  }

  .muted {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .hint {
    margin: 4px 0 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
    opacity: 0.8;
  }

  .flow-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
    margin: 0 0 12px 0;
    padding: 8px;
    text-align: center;
    opacity: 0.7;
    border-top: 1px solid var(--border);
    padding-top: 12px;
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

  .section-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .stat-item {
    display: grid;
    gap: 2px;
    text-align: center;
    padding: 8px;
    background: var(--surface-0);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .stat-value {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .progress-container {
    width: 100%;
    height: 6px;
    background: var(--surface-0);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .progress-bar {
    height: 100%;
    background: var(--accent, var(--text));
    transition: width 300ms ease-out;
    border-radius: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-bar {
      transition: none;
    }
  }

  .progress-text {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }

  .priority-stats {
    display: grid;
    gap: 6px;
  }

  .priority-stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--surface-0);
    border: 1px solid var(--border);
    font-size: 0.85rem;
  }

  .priority-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .priority-count {
    font-weight: 600;
    color: var(--text);
    min-width: 20px;
  }

  .priority-label {
    color: var(--text-muted);
    text-transform: lowercase;
    flex: 1;
  }

  .priority-stat-item.urgent .priority-count {
    color: #ef4444;
  }

  .priority-stat-item.high .priority-count {
    color: #fb923c;
  }

  .priority-stat-item.normal .priority-count {
    color: var(--text-muted);
  }

  .priority-stat-item.low .priority-count {
    color: #4ade80;
  }

  .auto-added-section {
    animation: highlightFade 2s ease;
  }

  @keyframes highlightFade {
    0% {
      background: var(--accent-light, var(--surface-0));
    }
    100% {
      background: transparent;
    }
  }

  .task-item.auto-added {
    border-color: var(--accent, var(--border));
    animation: slideIn 300ms ease;
  }

  .recurrence-icon {
    font-size: 0.75rem;
    color: var(--text-muted);
    opacity: 0.7;
    margin-left: 4px;
  }

  .focus-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }

  .focus-stat-item {
    display: grid;
    gap: 2px;
    text-align: center;
    padding: 8px;
    background: var(--surface-0);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .focus-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
  }

  .focus-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: lowercase;
  }

  .focus-score-container {
    display: grid;
    gap: 8px;
  }

  .focus-score-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .focus-score-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .focus-score-value {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--accent, var(--text));
  }

  .focus-score-bar {
    width: 100%;
    height: 8px;
    background: var(--surface-0);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .focus-score-fill {
    height: 100%;
    background: var(--accent, var(--text));
    transition: width 400ms ease-out;
    border-radius: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .focus-score-fill {
      transition: none;
    }
  }

  .focus-tasks-stats {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    display: grid;
    gap: 8px;
  }

  .focus-tasks-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
  }

  .focus-tasks-value {
    font-weight: 600;
    color: var(--text);
  }

  .focus-tasks-total {
    color: var(--text-muted);
  }

  .focus-tasks-label {
    color: var(--text-muted);
    margin-left: 4px;
  }

  .focus-tasks-progress {
    height: 4px;
    background: var(--surface-1);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .focus-tasks-progress-bar {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 300ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .focus-tasks-progress-bar {
      transition: none;
    }
  }

  .focus-tasks-percent {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: right;
  }


  .suggestions-list {
    display: grid;
    gap: 8px;
  }

  .suggestion {
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-0);
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--text);
  }

  .suggestion-start_task {
    background: var(--accent-light, var(--surface-0));
    border-color: var(--accent, var(--border));
    color: var(--text);
  }

  .suggestion-overdue_task {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: var(--text);
  }

  .suggestion-short_task {
    background: var(--surface-0);
    border-color: var(--border);
    color: var(--text-muted);
  }

  .suggestion-event_soon {
    background: var(--accent-light, var(--surface-0));
    border-color: var(--accent, var(--border));
    color: var(--text);
  }

  .suggestion-focus_low {
    background: rgba(251, 146, 60, 0.1);
    border-color: #fb923c;
    color: var(--text);
  }

  .suggestion-wrap_up {
    background: var(--surface-0);
    border-color: var(--border);
    color: var(--text-muted);
  }

  .suggestion-prep_event {
    background: rgba(251, 146, 60, 0.15);
    border-color: #fb923c;
    color: var(--text);
  }

  .data-note {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .schedule-status-section {
    padding: 10px 12px;
  }

  .schedule-status {
    margin: 0;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .schedule-indicator {
    color: var(--accent);
    font-weight: 600;
  }

  .schedule-cta {
    color: var(--text-muted);
    font-style: italic;
  }

  .task-list,
  .event-list {
    display: grid;
    gap: 6px;
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    background: var(--surface-0);
    border: 1px solid var(--border);
    font-size: 0.85rem;
  }

  .task-item.pending {
    color: var(--text);
  }

  .task-item.completed {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .task-checkbox {
    font-size: 0.9rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .task-item.completed .task-checkbox {
    color: var(--accent, var(--text));
  }

  .task-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-item.completed .task-title {
    text-decoration: line-through;
  }

  .event-item {
    display: grid;
    gap: 4px;
    padding: 8px;
    border-radius: var(--radius-sm);
    background: var(--surface-0);
    border: 1px solid var(--border);
    font-size: 0.85rem;
  }

  .event-time {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .time-separator {
    margin: 0 4px;
    color: var(--text-muted);
  }

  .event-title {
    color: var(--text);
    font-weight: 500;
  }
</style>

