<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import { tasksStore } from '../../stores/tasksStore';
  import { plannedEventsStore } from '../../stores/plannedEventsStore';
  import { focusStore } from '../../stores/focusStore';
  import type { Task } from '../../lib/api';
  import { normalizeDate } from '../../lib/dates/safeDate';
  import { parseTextToTask } from '../../lib/nlp/taskParser';
  import { autoScheduleTask, autoScheduleTasksForDate } from '../../lib/scheduler/autoScheduler';
  import { loadAutoScheduleOptionsForDate } from '../../lib/scheduler/schedulerContext';
  import { toastStore } from '../../stores/toastStore';
  import TaskEditorModal from './TaskEditorModal.svelte';
  import RecurrencePicker from './RecurrencePicker.svelte';
  import { createShortcutHandler } from '../../lib/keyboard/shortcuts';
  import type { Recurrence } from '../../lib/api';

  export let selectedDate: Date | undefined = new Date();

  const dispatch = createEventDispatcher<{ createTask: void }>();

  let tasks: Task[] = [];
  let input = '';
  let quickAddInput = '';
  let quickAddError: string | null = null;
  let selectedPriority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
  let selectedIsFocus = false;
  let selectedRecurrence: Recurrence | null = null;
  let focusOnly = false;
  let priorityFilter: 'all' | 'high+' | 'urgent' = 'all';
  let safeDate = new Date();
  $: safeDate = normalizeDate(selectedDate);
  let isEditorOpen = false;
  let editingTask: Task | null = null;
  let taskInputElement: HTMLInputElement | null = null;
  let newlyScheduledTaskIds = new Set<number>();
  let hoveredTaskId: number | null = null;
  // Soft-delete: task visually fades for 3s with Undo option before actual deletion
  let pendingDeleteIds = new Set<number>();
  const pendingDeleteTimers = new Map<number, ReturnType<typeof setTimeout>>();

  function handleKeydown(e: KeyboardEvent) {
    // Don't handle shortcuts if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const shortcuts = createShortcutHandler([
      {
        shortcut: { key: 'n' },
        handler: () => {
          e.preventDefault();
          if (taskInputElement) {
            taskInputElement.focus();
          } else {
            dispatch('createTask');
          }
        },
      },
      {
        shortcut: { key: 'f' },
        handler: () => {
          e.preventDefault();
          focusStore.toggleFocusMode();
        },
      },
    ]);

    shortcuts(e);
  }

  function handleFocusTaskInput() {
    if (taskInputElement) {
      taskInputElement.focus();
    }
  }

  onMount(() => {
    const unsub = tasksStore.tasksForSelectedDate.subscribe((list) => (tasks = list || []));
    const unsubFocus = focusStore.focusModeEnabled.subscribe((enabled) => { focusOnly = enabled; });
    (async () => {
      await tasksStore.loadAll();
      await tasksStore.loadTasksForDate(safeDate);
    })();
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('focus-task-input', handleFocusTaskInput);
    return () => {
      unsub();
      unsubFocus();
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('focus-task-input', handleFocusTaskInput);
    };
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('focus-task-input', handleFocusTaskInput);
    // Cancel any pending delete timers
    for (const timer of pendingDeleteTimers.values()) {
      clearTimeout(timer);
    }
    pendingDeleteTimers.clear();
  });

  $: safeDate && tasksStore.loadTasksForDate(safeDate);

  async function addTask() {
    if (!input.trim()) return;
    await tasksStore.create(input.trim(), safeDate, selectedPriority, selectedIsFocus, selectedRecurrence);
    input = '';
    selectedPriority = 'normal'; // Reset to default
    selectedIsFocus = false;
    selectedRecurrence = null;
  }

  async function quickAdd() {
    if (!quickAddInput.trim()) return;
    
    try {
      quickAddError = null;
      const parsed = parseTextToTask(quickAddInput);
      
      if (!parsed.date) {
        quickAddError = 'Could not parse date. Please specify a date.';
        return;
      }
      
      // Use quickAdd from store which will call the backend parser
      await tasksStore.quickAdd(quickAddInput);
      quickAddInput = '';
      quickAddError = null;
    } catch (err) {
      console.error('Quick add error:', err);
      quickAddError = 'Failed to create task. Please try again.';
    }
  }

  async function toggle(task: Task) {
    if (!task.id) return;
    await tasksStore.toggle(task.id, !task.done);
  }

  function remove(task: Task) {
    if (!task.id) return;
    const id = task.id;
    if (pendingDeleteTimers.has(id)) return; // already pending
    // Add to pending set (triggers Svelte reactivity)
    pendingDeleteIds = new Set([...pendingDeleteIds, id]);
    const timer = setTimeout(() => commitDelete(id), 3000);
    pendingDeleteTimers.set(id, timer);
  }

  function undoDelete(task: Task) {
    if (!task.id) return;
    const id = task.id;
    const timer = pendingDeleteTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      pendingDeleteTimers.delete(id);
      pendingDeleteIds = new Set([...pendingDeleteIds].filter((x) => x !== id));
    }
  }

  async function commitDelete(id: number) {
    pendingDeleteTimers.delete(id);
    pendingDeleteIds = new Set([...pendingDeleteIds].filter((x) => x !== id));
    await tasksStore.delete(id);
  }

  function editTask(task: Task) {
    editingTask = task;
    isEditorOpen = true;
  }

  function closeEditor() {
    isEditorOpen = false;
    editingTask = null;
  }

  function onDragStartTask(e: DragEvent, task: Task) {
    if (!task.id) return;
    
    const dragData = {
      type: 'task',
      taskId: task.id,
      title: task.title,
      estimated: task.estimatedMinutes || 30,
      color: getPriorityColor(task.priority ?? 'normal'),
    };
    
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'move';
      // Create custom drag image
      if (e.dataTransfer && e.dataTransfer.setDragImage) {
        const dragImage = document.createElement('div');
        dragImage.textContent = `Task: ${task.title}`;
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        dragImage.style.left = '-1000px';
        dragImage.style.padding = '8px 12px';
        dragImage.style.background = 'var(--surface-0)';
        dragImage.style.border = '1px solid var(--border)';
        dragImage.style.borderRadius = 'var(--radius-md)';
        dragImage.style.color = 'var(--text)';
        dragImage.style.fontSize = '0.85rem';
        dragImage.style.boxShadow = 'var(--shadow-md)';
        dragImage.style.whiteSpace = 'nowrap';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 10, 10);
        setTimeout(() => {
          if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
          }
        }, 0);
      }
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#fb923c';
      case 'normal': return 'var(--accent)';
      case 'low': return '#4ade80';
      default: return 'var(--accent)';
    }
  }

  async function handleAutoSchedule(task: Task) {
    if (task.done) {
      toastStore.showError('Cannot schedule completed tasks');
      return;
    }

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
    if (task.id !== undefined) {
      const taskId = task.id;
      newlyScheduledTaskIds.add(taskId);
      setTimeout(() => {
        newlyScheduledTaskIds.delete(taskId);
      }, 2000);
    }
    toastStore.showSuccess(`"${task.title}" scheduled for ${new Date(plannedEvent.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  }

  function handleStartFocus(task: Task) {
    if (!task.id) return;
    const durationMinutes = task.estimatedMinutes || undefined;
    focusStore.startSessionFromTask(task.id, task.title, durationMinutes);
    toastStore.showSuccess(`Focus session started for "${task.title}"`);
  }

  async function handleAutoScheduleAll() {
    const pendingTasks = tasks.filter((t) => !t.done);

    if (pendingTasks.length === 0) {
      toastStore.showError('No pending tasks to schedule');
      return;
    }

    const existingBlocks = plannedEventsStore.blocksForDate(safeDate);
    const options = await loadAutoScheduleOptionsForDate(safeDate);
    const result = autoScheduleTasksForDate(tasks, safeDate, existingBlocks, options);

    let scheduledCount = 0;
    let rejectedCount = 0;
    for (const block of result.scheduled) {
      try {
        await plannedEventsStore.addBlock(block);
        scheduledCount += 1;
      } catch {
        rejectedCount += 1;
      }
    }

    const unscheduledCount = result.unscheduled.length + rejectedCount;

    if (scheduledCount === 0) {
      toastStore.showError('No tasks could be scheduled - no free time available today.');
    } else {
      const message = unscheduledCount > 0
        ? `Scheduled ${scheduledCount} task${scheduledCount !== 1 ? 's' : ''}. ${unscheduledCount} could not be scheduled (no free time left).`
        : `Scheduled ${scheduledCount} task${scheduledCount !== 1 ? 's' : ''}.`;
      toastStore.showSuccess(message);
    }
  }

  $: hasPendingTasks = (tasks || []).filter((t) => !t.done).length > 0;

  $: filteredTasks = (tasks || []).filter((task) => {
    if (focusOnly && !task.isFocus) return false;
    if (priorityFilter === 'high+') {
      return task.priority === 'high' || task.priority === 'urgent';
    }
    if (priorityFilter === 'urgent') {
      return task.priority === 'urgent';
    }
    return true;
  });

  function getFlowState(): 'empty' | 'balanced' | 'overloaded' {
    const pending = (filteredTasks || []).filter((t) => !t.done);
    if (pending.length === 0) return 'empty';
    if (pending.length > 10) return 'overloaded';
    return 'balanced';
  }

  $: flowState = getFlowState();
  $: flowHint = flowState === 'empty' && (tasks || []).length === 0
    ? 'Add your first task above'
    : flowState === 'overloaded'
    ? 'Consider breaking down large tasks'
    : null;
  </script>

<div class="todo-panel">
  <div class="head">
    <div>
      <p class="eyebrow">Tasks</p>
      <h4>{safeDate.toDateString()}</h4>
    </div>
    <div class="counts">
      <span>{tasks.filter((t) => t.done).length}</span>/<span>{tasks.length}</span>
    </div>
  </div>
  
  <!-- Quick Add with NLP -->
  <div class="quick-add-section">
    <input
      type="text"
      class="quick-add-input"
      placeholder="Add task… e.g. 'buy milk tomorrow at 8' or 'urgent meeting today at 14:00'"
      bind:value={quickAddInput}
      on:keydown={(e) => e.key === 'Enter' && quickAdd()}
    />
    {#if quickAddError}
      <p class="quick-add-error">{quickAddError}</p>
    {/if}
  </div>
  
  <div class="input-row">
    <input
      bind:this={taskInputElement}
      type="text"
      placeholder="Add a task and hit Enter"
      bind:value={input}
      on:keydown={(e) => e.key === 'Enter' && addTask()}
    />
    <select bind:value={selectedPriority} class="priority-select">
      <option value="low">Low</option>
      <option value="normal">Normal</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
    </select>
    <label class="focus-checkbox">
      <input type="checkbox" bind:checked={selectedIsFocus} />
      <span>Focus</span>
    </label>
    <button class="ghost" on:click={addTask}>Add</button>
  </div>

  <!-- Repeat Section -->
  <div class="repeat-section">
    <RecurrencePicker value={selectedRecurrence} onChange={(r) => selectedRecurrence = r} />
  </div>

  {#if tasks.length === 0}
    <p class="muted">No tasks yet. Add one above.</p>
  {:else}
    <div class="filters">
      <button 
        class="ghost filter-btn" 
        class:active={focusOnly}
        on:click={() => focusOnly = !focusOnly}
      >
        {focusOnly ? 'All tasks' : 'Focus only'}
      </button>
      <select bind:value={priorityFilter} class="priority-filter">
        <option value="all">All priorities</option>
        <option value="high+">High & Urgent</option>
        <option value="urgent">Urgent only</option>
      </select>
    </div>
    {#if hasPendingTasks}
      <button 
        class="ghost auto-schedule-all-btn" 
        on:click={handleAutoScheduleAll}
        aria-label="Auto-schedule all pending tasks"
      >
        Auto-schedule all
      </button>
    {/if}
    {#if (filteredTasks || []).length === 0 && (tasks || []).length > 0}
      <p class="muted hint">No tasks match the current filters</p>
    {/if}
    {#if flowHint}
      <p class="flow-hint">{flowHint}</p>
    {/if}
    <ul class="list">
      {#each filteredTasks as task (task.id || task.title + task.date)}
        <li 
          class="task-item"
          class:done={task.done}
          class:focus-task={task.isFocus}
          class:newly-scheduled={task.id !== undefined && newlyScheduledTaskIds.has(task.id)}
          class:pending-delete={task.id !== undefined && pendingDeleteIds.has(task.id)}
          draggable="true"
          on:dragstart={(e) => onDragStartTask(e, task)}
          class:draggable={!task.done}
          transition:slide={{ duration: 150, axis: 'y' }}
          role="listitem"
          on:mouseenter={() => hoveredTaskId = task.id || null}
          on:mouseleave={() => hoveredTaskId = null}
        >
          <label>
            <input type="checkbox" checked={task.done} on:change={() => toggle(task)} />
            <span class="priority-badge priority-{task.priority}" title="Priority: {task.priority}">
              {task.priority}
            </span>
            {#if task.isFocus}
              <span class="focus-badge" title="Focus task">🎯</span>
            {/if}
            <span class:done={task.done}>{task.title}</span>
            {#if task.recurrence}
              <span class="recurrence-icon" title="Recurring task">↻</span>
            {/if}
          </label>
          <div 
            class="task-actions"
            class:visible={hoveredTaskId === task.id}
          >
            {#if !task.done}
              <button 
                class="ghost tiny auto-schedule-btn" 
                on:click={() => handleAutoSchedule(task)} 
                title="Auto-schedule"
                aria-label="Auto-schedule {task.title}"
              >
                Auto-schedule
            </button>
            {#if task.isFocus}
              <button
                class="ghost tiny focus-btn"
                on:click={() => handleStartFocus(task)}
                title="Start focus session"
                aria-label="Start focus session for {task.title}"
              >
                ▶ Focus
              </button>
            {/if}
          {/if}
            <button 
              class="ghost tiny" 
              on:click={() => editTask(task)}
              aria-label="Edit {task.title}"
            >
              Edit
            </button>
            {#if task.id !== undefined && pendingDeleteIds.has(task.id)}
              <button
                class="ghost tiny undo-delete"
                on:click={() => undoDelete(task)}
                aria-label="Undo delete {task.title}"
              >
                Undo
              </button>
            {:else}
              <button
                class="ghost tiny"
                on:click={() => remove(task)}
                aria-label="Delete {task.title}"
              >
                Delete
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<TaskEditorModal isOpen={isEditorOpen} task={editingTask} on:close={closeEditor} on:saved={closeEditor} on:deleted={closeEditor} />

<style>
  .todo-panel { display: grid; gap: 10px; }
  .head { display: flex; align-items: center; justify-content: space-between; }
  .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-size: 0.8rem; }
  h4 { margin: 0; }
  .counts { color: var(--text-muted); }
  
  .quick-add-section {
    display: grid;
    gap: 4px;
  }
  
  .quick-add-input {
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--text);
    font-size: 0.9rem;
  }
  
  .quick-add-input:focus {
    outline: 2px solid var(--accent);
    border-color: var(--accent);
  }
  
  .quick-add-error {
    margin: 0;
    font-size: 0.75rem;
    color: #ef4444;
    padding: 4px 8px;
  }
  
  .input-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; align-items: center; }
  .input-row input {
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--text);
  }
  .input-row input:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
  .priority-select {
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--text);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .priority-select:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
  .focus-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px;
    font-size: 0.85rem;
    cursor: pointer;
    user-select: none;
  }
  .focus-checkbox input[type="checkbox"] {
    cursor: pointer;
  }
  .filters {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .filter-btn {
    padding: 8px 12px;
    font-size: 0.85rem;
  }
  .filter-btn.active {
    background: var(--accent);
    color: var(--accent-text, white);
    border-color: var(--accent);
  }
  .priority-filter {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--text);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .priority-filter:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
  .ghost {
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .ghost:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
  li.task-item { 
    display: grid; 
    grid-template-columns: 1fr auto; 
    align-items: center; 
    gap: 8px; 
    padding: 8px; 
    border: 1px solid var(--border); 
    border-radius: var(--radius-sm); 
    background: var(--surface-1);
    transition: transform 150ms ease-out, box-shadow 150ms ease-out, opacity 150ms ease-out, border-color 150ms ease-out;
  }

  @media (prefers-reduced-motion: no-preference) {
    li.task-item {
      transition: transform 150ms ease-out, box-shadow 150ms ease-out, opacity 150ms ease-out, border-color 150ms ease-out;
    }
  }

  li.task-item:hover:not(.done) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
    border-color: var(--border-light);
  }

  li.task-item.focus-task {
    border-left: 3px solid var(--accent);
    background: var(--surface-0);
    position: relative;
  }

  @media (prefers-reduced-motion: no-preference) {
    li.task-item.focus-task::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: var(--radius-sm);
      background: var(--accent);
      opacity: 0.15;
      animation: pulseGlow 2s ease-out infinite;
      pointer-events: none;
      z-index: -1;
    }
  }

  @keyframes pulseGlow {
    0%, 100% {
      opacity: 0.15;
    }
    50% {
      opacity: 0.25;
    }
  }

  li.task-item.focus-task:hover:not(.done) {
    box-shadow: var(--shadow-md);
  }

  li.task-item.done {
    opacity: 0.6;
  }

  li.task-item.pending-delete {
    opacity: 0.45;
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.06);
    transition: opacity 200ms ease, border-color 200ms ease;
  }

  .undo-delete {
    color: #ef4444 !important;
    border-color: #ef4444 !important;
  }

  .undo-delete:hover {
    background: rgba(239, 68, 68, 0.1) !important;
  }

  @media (prefers-reduced-motion: no-preference) {
    li.task-item.newly-scheduled {
      animation: schedulePulse 1.5s ease-out;
    }
  }

  @keyframes schedulePulse {
    0% {
      box-shadow: 0 0 0 0 var(--accent);
    }
    50% {
      box-shadow: 0 0 0 4px var(--accent);
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

  .hint {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
    margin: 8px 0 0 0;
    padding: 8px;
    text-align: center;
  }

  .task-actions {
    display: flex;
    gap: 6px;
    align-items: center;
    opacity: 0;
    visibility: hidden;
    transition: opacity 150ms ease-out, visibility 150ms ease-out;
  }

  .task-actions.visible {
    opacity: 1;
    visibility: visible;
  }

  @media (prefers-reduced-motion: reduce) {
    .task-actions {
      transition: none;
    }
  }

  .flow-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
    margin: 8px 0 0 0;
    padding: 8px;
    text-align: center;
    opacity: 0.8;
  }

  .auto-schedule-btn {
    font-size: 0.8rem;
    padding: 4px 8px;
  }

  .auto-schedule-all-btn {
    width: 100%;
    margin-bottom: 8px;
    padding: 10px;
    font-weight: 500;
  }

  li.task-item.draggable {
    cursor: grab;
  }

  li.task-item.draggable:active {
    cursor: grabbing;
    opacity: 0.7;
  }
  label { display: flex; align-items: center; gap: 8px; color: var(--text); }
  .priority-badge {
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }
  .priority-badge.priority-low {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }
  .priority-badge.priority-normal {
    background: var(--surface-1);
    color: var(--text-muted);
  }
  .priority-badge.priority-high {
    background: rgba(251, 146, 60, 0.15);
    color: #fb923c;
  }
  .priority-badge.priority-urgent {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
  .focus-badge {
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  .repeat-section {
    margin-top: 8px;
  }

  .recurrence-icon {
    font-size: 0.85rem;
    color: var(--text-muted);
    opacity: 0.7;
    margin-left: 4px;
  }
  .done { text-decoration: line-through; color: var(--text-muted); }
  .muted { color: var(--text-muted); margin: 0; }
  .ghost.tiny { padding: 6px 8px; font-size: 0.9rem; }
</style>





