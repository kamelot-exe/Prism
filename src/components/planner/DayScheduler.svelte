<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { scale } from 'svelte/transition';
  import { plannedEventsStore, PlannedBlockValidationError } from '../../stores/plannedEventsStore';
  import type { PlannedEvent } from '../../stores/plannedEventsStore';
  import { tasksStore } from '../../stores/tasksStore';
  import { toastStore } from '../../stores/toastStore';
  import { normalizeDate } from '../../lib/dates/safeDate';
  import { dateToYPosition, yPositionToDate, snapToMinutes, durationFromDrag, PIXELS_PER_MINUTE, startOfDay, endOfDay, clampToDayBounds, findNextSlot } from '../../lib/dates/positioning';
  import { getTimePeriodLabel } from '../../lib/dates/context';
  import { blockConflictsWithEvents } from '../../lib/scheduler/conflicts';
  import { eventsStore } from '../../stores/eventsStore';
  import type { Event } from '../../lib/api';
  import { focusStore } from '../../stores/focusStore';
  import { createSelectionState, toggleSelection, clearSelection, isSelected, getSelectedCount, type SelectionState } from '../../lib/planner/selection';
  import { confirmDelete } from '../../lib/confirm';

  export let currentDate: Date | undefined = new Date();

  let safeDate = new Date();
  $: safeDate = normalizeDate(currentDate);

  let blocks: PlannedEvent[] = [];
  let timelineContainer: HTMLDivElement;
  let schedulerGrid: HTMLDivElement;
  let dayEvents: Event[] = [];

  let draggedBlock: PlannedEvent | null = null;
  let dragStartY = 0;
  let dragStartTime: Date | null = null;
  let isResizing = false;
  let resizeStartY = 0;
  let resizeStartEnd: Date | null = null;

  let externalDragData: { type?: string; taskId?: number; title: string; estimated?: number; color?: string } | null = null;
  let isDraggingOver = false;

  let hoveredBlockId: string | null = null;
  let newlyAddedBlockIds = new Set<string>();
  let selection: SelectionState = createSelectionState();
  let selectedBlocksOriginalPositions = new Map<string, { start: Date; end: Date }>();
  let lastMutationError: string | null = null;

  $: dayStart = startOfDay(safeDate);
  $: hours = Array.from({ length: 24 }, (_, i) => i);

  let unsubscribe: (() => void) | null = null;
  let eventsUnsubscribe: (() => void) | null = null;

  onMount(() => {
    unsubscribe = plannedEventsStore.subscribe(() => {
      blocks = plannedEventsStore.blocksForDate(safeDate);
    });
    eventsUnsubscribe = eventsStore.subscribe(() => {
      loadDayEvents();
    });
    loadBlocks();
    loadDayEvents();

    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);

    const currentHour = new Date().getHours();
    timelineContainer?.parentElement?.scrollTo({ top: Math.max(0, (currentHour - 1) * 72) });

    setTimeout(() => {
      schedulerGrid?.addEventListener('keydown', handleKeydown);
    }, 0);

    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
      schedulerGrid?.removeEventListener('keydown', handleKeydown);
    };
  });

  onDestroy(() => {
    unsubscribe?.();
    eventsUnsubscribe?.();
  });

  $: safeDate && (() => {
    loadBlocks();
    loadDayEvents();
  })();

  function loadBlocks() {
    blocks = plannedEventsStore.blocksForDate(safeDate);
  }

  function loadDayEvents() {
    const start = startOfDay(safeDate);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    dayEvents = eventsStore.eventsInRange(start, end);
  }

  function getMutationErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof PlannedBlockValidationError) {
      return err.message;
    }
    return fallback;
  }

  function reportMutationError(err: unknown, fallback: string): void {
    const message = getMutationErrorMessage(err, fallback);
    if (message !== lastMutationError) {
      lastMutationError = message;
      toastStore.showError(message);
    }
  }

  function clearMutationError(): void {
    lastMutationError = null;
  }

  function handleGlobalDragOver(e: DragEvent) {
    const hasTaskData = e.dataTransfer?.types.includes('application/json') || externalDragData;
    if (hasTaskData) {
      e.preventDefault();
      e.stopPropagation();
      if (schedulerGrid && schedulerGrid.contains(e.target as Node)) {
        isDraggingOver = true;
      }
    }
  }

  function handleDragLeave(e: DragEvent) {
    const target = e.relatedTarget as EventTarget | null;
    if (target && target instanceof Node && !schedulerGrid.contains(target)) {
      isDraggingOver = false;
    } else if (!target) {
      isDraggingOver = false;
    }
  }

  async function handleGlobalDrop(e: DragEvent) {
    if (!schedulerGrid) return;

    let dragData = externalDragData;
    if (!dragData) {
      try {
        const dataStr = e.dataTransfer?.getData('application/json');
        if (dataStr) {
          dragData = JSON.parse(dataStr);
        }
      } catch (err) {
        console.error('Failed to parse drag data', err);
      }
    }

    if (!dragData || (dragData as any).type !== 'task') {
      isDraggingOver = false;
      return;
    }

    const rect = schedulerGrid.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startTime = yPositionToDate(y, dayStart);
    const snappedMinutes = snapToMinutes(startTime.getMinutes(), 5);
    startTime.setMinutes(snappedMinutes, 0, 0);

    const duration = dragData.estimated || 30;
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + duration);

    const newBlockData = {
      taskId: dragData.taskId,
      title: dragData.title,
      start: startTime,
      end: endTime,
      color: dragData.color,
    };

    let newBlock: PlannedEvent;
    try {
      newBlock = await plannedEventsStore.addBlock(newBlockData);
      clearMutationError();
    } catch (err) {
      reportMutationError(err, 'Could not create planned block');
      isDraggingOver = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const eventConflicts = blockConflictsWithEvents(newBlock, dayEvents);
    if (eventConflicts.length > 0) {
      toastStore.showWarning('Overlaps with calendar event');
    }

    newlyAddedBlockIds.add(newBlock.id);
    setTimeout(() => {
      newlyAddedBlockIds.delete(newBlock.id);
    }, 2000);

    const startTimeStr = new Date(newBlock.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = new Date(newBlock.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    toastStore.showSuccess(`Scheduled: ${startTimeStr}-${endTimeStr}`);

    externalDragData = null;
    isDraggingOver = false;
    e.preventDefault();
    e.stopPropagation();
  }

  function handleBlockMouseDown(e: MouseEvent, block: PlannedEvent) {
    if (block.completed) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const rect = schedulerGrid.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const blockY = dateToYPosition(block.start, dayStart);
    const blockHeight = dateToYPosition(block.end, dayStart) - blockY;
    const clickY = y - blockY;
    const isNearBottom = clickY > blockHeight - 10;

    if (!isNearBottom) {
      const isShiftClick = e.shiftKey;
      selection = toggleSelection(selection, block.id, isShiftClick);

      selectedBlocksOriginalPositions.clear();
      selection.selectedIds.forEach((id) => {
        const selectedBlock = blocks.find((entry) => entry.id === id);
        if (selectedBlock) {
          selectedBlocksOriginalPositions.set(id, {
            start: new Date(selectedBlock.start),
            end: new Date(selectedBlock.end),
          });
        }
      });
    }

    if (isNearBottom) {
      isResizing = true;
      draggedBlock = block;
      resizeStartY = e.clientY;
      resizeStartEnd = new Date(block.end);
      selection = { selectedIds: new Set([block.id]), primaryId: block.id };
    } else {
      if (selection.selectedIds.has(block.id)) {
        draggedBlock = block;
      } else {
        draggedBlock = block;
        selection = { selectedIds: new Set([block.id]), primaryId: block.id };
        selectedBlocksOriginalPositions.clear();
        selectedBlocksOriginalPositions.set(block.id, {
          start: new Date(block.start),
          end: new Date(block.end),
        });
      }
      dragStartY = e.clientY;
      dragStartTime = new Date(block.start);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  async function handleMouseMove(e: MouseEvent) {
    if (!schedulerGrid) return;

    const rect = schedulerGrid.getBoundingClientRect();
    const currentY = e.clientY - rect.top;
    const dayEnd = endOfDay(dayStart);

    if (isResizing && draggedBlock && resizeStartEnd) {
      const deltaY = e.clientY - resizeStartY;
      const deltaMinutes = durationFromDrag(deltaY);
      let newEnd = new Date(resizeStartEnd);
      newEnd.setMinutes(newEnd.getMinutes() + deltaMinutes);

      const snappedMinutes = snapToMinutes(newEnd.getMinutes(), 5);
      newEnd.setMinutes(snappedMinutes, 0, 0);

      const minEnd = new Date(draggedBlock.start);
      minEnd.setMinutes(minEnd.getMinutes() + 5);
      if (newEnd <= draggedBlock.start || newEnd < minEnd) {
        newEnd.setTime(minEnd.getTime());
      }

      const clampedEnd = clampToDayBounds(newEnd, dayStart, dayEnd);

      try {
        await plannedEventsStore.updateBlockDuration(draggedBlock.id, clampedEnd);
        clearMutationError();
      } catch (err) {
        reportMutationError(err, 'Could not resize planned block');
      }
      return;
    }

    if (draggedBlock && dragStartTime) {
      const deltaY = currentY - (dragStartY - rect.top);
      const deltaMinutes = deltaY / PIXELS_PER_MINUTE;
      const newStart = new Date(dragStartTime);
      newStart.setMinutes(newStart.getMinutes() + deltaMinutes);

      const snappedMinutes = snapToMinutes(newStart.getMinutes(), 5);
      newStart.setMinutes(snappedMinutes, 0, 0);

      const duration = draggedBlock.end.getTime() - draggedBlock.start.getTime();
      const newEnd = new Date(newStart.getTime() + duration);
      const clampedStart = clampToDayBounds(newStart, dayStart, dayEnd);
      const clampedEnd = clampToDayBounds(newEnd, dayStart, dayEnd);

      if (selection.selectedIds.size > 1) {
        const updates: Array<{ id: string; start: Date; end: Date }> = [];
        const deltaMs = clampedStart.getTime() - dragStartTime.getTime();

        selection.selectedIds.forEach((id) => {
          const original = selectedBlocksOriginalPositions.get(id);
          if (original) {
            const blockStart = new Date(original.start.getTime() + deltaMs);
            const blockEnd = new Date(original.end.getTime() + deltaMs);
            const snappedStartMinutes = snapToMinutes(blockStart.getMinutes(), 5);
            blockStart.setMinutes(snappedStartMinutes, 0, 0);
            const blockDuration = blockEnd.getTime() - blockStart.getTime();
            blockEnd.setTime(blockStart.getTime() + blockDuration);

            updates.push({
              id,
              start: clampToDayBounds(blockStart, dayStart, dayEnd),
              end: clampToDayBounds(blockEnd, dayStart, dayEnd),
            });
          }
        });

        if (updates.length > 0) {
          try {
            await plannedEventsStore.updateBlocksBulk(updates);
            clearMutationError();
          } catch (err) {
            reportMutationError(err, 'Could not move planned blocks');
          }
        }
      } else {
        try {
          await plannedEventsStore.updateBlockPosition(draggedBlock.id, clampedStart, clampedEnd);
          clearMutationError();
        } catch (err) {
          reportMutationError(err, 'Could not move planned block');
        }
      }
    }
  }

  function handleMouseUp() {
    if (isResizing && draggedBlock) {
      const blockElement = document.querySelector(`[data-block-id="${draggedBlock.id}"]`) as HTMLElement;
      if (blockElement) {
        blockElement.classList.add('resize-overshoot');
        setTimeout(() => {
          blockElement.classList.remove('resize-overshoot');
        }, 200);
      }
    }

    draggedBlock = null;
    isResizing = false;
    clearMutationError();
    dragStartY = 0;
    dragStartTime = null;
    resizeStartY = 0;
    resizeStartEnd = null;

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  function formatHour(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  function getFlowState(): 'empty' | 'balanced' | 'overloaded' {
    if (blocks.length === 0) return 'empty';

    const totalMinutes = blocks.reduce((sum, block) => {
      const duration = (block.end.getTime() - block.start.getTime()) / (1000 * 60);
      return sum + duration;
    }, 0);

    if (totalMinutes > 480) return 'overloaded';
    if (totalMinutes >= 120) return 'balanced';
    return 'empty';
  }

  $: flowState = getFlowState();
  $: flowHint = flowState === 'empty'
    ? 'Drop tasks here to build the day plan'
    : flowState === 'overloaded'
    ? 'The day is dense. Review blocks and free time before adding more'
    : null;

  function getBlockStyle(block: PlannedEvent) {
    const top = dateToYPosition(block.start, dayStart);
    const height = dateToYPosition(block.end, dayStart) - top;
    const color = block.color || 'var(--accent)';

    return `
      top: ${top}px;
      height: ${height}px;
      background: ${color};
    `;
  }

  function getBlockClasses(block: PlannedEvent): string {
    const classes = ['scheduler-block'];
    if (blockConflictsWithEvents(block, dayEvents).length > 0) {
      classes.push('has-event-conflict');
    }
    if (isResizing && draggedBlock?.id === block.id) {
      classes.push('resizing');
    }
    if (block.completed) {
      classes.push('completed');
    }
    if (hoveredBlockId === block.id) {
      classes.push('hovered');
    }
    if (isSelected(selection, block.id)) {
      classes.push('selected');
    }
    return classes.join(' ');
  }

  $: selectedCount = getSelectedCount(selection);
  $: selectionHint = selectedCount > 0
    ? `${selectedCount} selected - Drag to move - Delete to remove${selectedCount === 1 ? ' - Ctrl+D to duplicate' : ''}`
    : null;

  async function handleComplete(e: MouseEvent, block: PlannedEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (block.taskId) {
      const allTasks = get(tasksStore);
      const task = allTasks.find((t) => t.id === block.taskId);
      if (task && task.id) {
        await tasksStore.toggle(task.id, !task.done);
      }
    }

    try {
      await plannedEventsStore.updateBlock(block.id, { completed: true });
      clearMutationError();
      toastStore.showSuccess('Task completed');
    } catch (err) {
      reportMutationError(err, 'Could not update planned block');
    }
  }

  async function handleRemove(e: MouseEvent, block: PlannedEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (!confirmDelete('this planned block')) {
      return;
    }

    await plannedEventsStore.removeBlock(block.id);
    toastStore.showSuccess('Block removed');
    if (selection.selectedIds.has(block.id)) {
      selection = clearSelection();
    }
  }

  function handleStartFocus(e: MouseEvent, block: PlannedEvent) {
    e.stopPropagation();
    e.preventDefault();
    focusStore.startSessionFromBlock(block.id, block.title, block.start, block.end);
  }

  async function handleDuplicate(e: MouseEvent, block: PlannedEvent) {
    e.stopPropagation();
    e.preventDefault();

    const dayEnd = endOfDay(dayStart);
    const nextStart = findNextSlot(block.end, dayEnd);
    const duration = block.end.getTime() - block.start.getTime();
    const nextEnd = new Date(nextStart.getTime() + duration);
    const finalEnd = clampToDayBounds(nextEnd, dayStart, dayEnd);
    const finalStart = new Date(finalEnd.getTime() - duration);
    const clampedFinalStart = clampToDayBounds(finalStart, dayStart, dayEnd);

    try {
      const newBlock = await plannedEventsStore.duplicateBlock(block.id, clampedFinalStart, finalEnd);
      clearMutationError();
      newlyAddedBlockIds.add(newBlock.id);
      setTimeout(() => {
        newlyAddedBlockIds.delete(newBlock.id);
      }, 2000);
      toastStore.showSuccess('Block duplicated');
    } catch (err) {
      reportMutationError(err, 'Failed to duplicate block');
    }
  }

  async function handleBulkDelete() {
    const selectedIds = Array.from(selection.selectedIds);
    if (selectedIds.length === 0) return;

    if (!confirmDelete('planned blocks', selectedIds.length)) {
      return;
    }

    await plannedEventsStore.removeBlocks(selectedIds);
    selection = clearSelection();
    toastStore.showSuccess(selectedIds.length > 1 ? `${selectedIds.length} blocks deleted` : 'Block deleted');
  }

  async function handleDuplicatePrimary() {
    if (!selection.primaryId) return;

    const block = blocks.find((b) => b.id === selection.primaryId);
    if (!block) return;

    const dayEnd = endOfDay(dayStart);
    const nextStart = findNextSlot(block.end, dayEnd);
    const duration = block.end.getTime() - block.start.getTime();
    const nextEnd = new Date(nextStart.getTime() + duration);
    const finalEnd = clampToDayBounds(nextEnd, dayStart, dayEnd);
    const finalStart = new Date(finalEnd.getTime() - duration);
    const clampedFinalStart = clampToDayBounds(finalStart, dayStart, dayEnd);

    try {
      const newBlock = await plannedEventsStore.duplicateBlock(block.id, clampedFinalStart, finalEnd);
      clearMutationError();
      newlyAddedBlockIds.add(newBlock.id);
      setTimeout(() => {
        newlyAddedBlockIds.delete(newBlock.id);
      }, 2000);
      toastStore.showSuccess('Block duplicated');
    } catch (err) {
      reportMutationError(err, 'Failed to duplicate block');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      selection = clearSelection();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleBulkDelete();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      handleDuplicatePrimary();
    }
  }

  function handleGridClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const isBlockClick = target.closest('.scheduler-block') !== null;
    if (!isBlockClick) {
      selection = clearSelection();
    }
  }
</script>

<div class="day-scheduler">
  <div class="timeline-column" bind:this={timelineContainer}>
    {#each hours as hour}
      {@const period = getTimePeriodLabel(hour)}
      {@const showPeriod = hour === 0 || (hour > 0 && getTimePeriodLabel(hour - 1) !== period)}
      <div class="timeline-hour">
        <span class="hour-label">{formatHour(hour)}</span>
        {#if showPeriod}
          <span class="period-label">{period}</span>
        {/if}
      </div>
    {/each}
  </div>

  <div
    class="scheduler-grid"
    bind:this={schedulerGrid}
    class:is-dragging-over={isDraggingOver}
    role="application"
    aria-label="Daily scheduler"
    tabindex="0"
    on:click={handleGridClick}
    on:dragover={(e) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingOver = true;
    }}
    on:dragleave={(e) => handleDragLeave(e)}
    on:drop={handleGlobalDrop}
  >
    <div class="planner-guide" role="note">Drag tasks here to plan the day. Drag a block to move it, drag its bottom edge to resize it, and watch for red outlines when a block overlaps an event.</div>

    {#each blocks as block (block.id)}
      <div
        class={getBlockClasses(block)}
        class:newly-added={newlyAddedBlockIds.has(block.id)}
        style={getBlockStyle(block)}
        data-block-id={block.id}
        on:mousedown={(e) => handleBlockMouseDown(e, block)}
        on:mouseenter={() => hoveredBlockId = block.id}
        on:mouseleave={() => hoveredBlockId = null}
        on:focus={() => hoveredBlockId = block.id}
        on:blur={() => hoveredBlockId = null}
        role="button"
        tabindex="0"
        aria-label="{block.title} from {new Date(block.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to {new Date(block.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"
        transition:scale={{ duration: 150, start: 0.95 }}
      >
        <div class="block-content">
          <span class="block-title">{block.title}</span>
          <span class="block-time">
            {new Date(block.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
            {new Date(block.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            <span class="time-period">{getTimePeriodLabel(new Date(block.start).getHours())}</span>
          </span>
        </div>
        <div class="block-resize-handle"></div>
        <div class="block-actions" class:visible={hoveredBlockId === block.id || isSelected(selection, block.id)}>
          {#if !block.completed}
            <button
              class="block-action block-action-focus"
              on:click={(e) => handleStartFocus(e, block)}
              on:mousedown|stopPropagation
              title="Start focus session"
              aria-label="Start focus session for {block.title}"
            >
              Go
            </button>
            <button
              class="block-action block-action-complete"
              on:click={(e) => handleComplete(e, block)}
              on:mousedown|stopPropagation
              title="Complete"
              aria-label="Complete {block.title}"
            >
              Done
            </button>
            <button
              class="block-action block-action-duplicate"
              on:click={(e) => handleDuplicate(e, block)}
              on:mousedown|stopPropagation
              title="Duplicate"
              aria-label="Duplicate {block.title}"
            >
              Copy
            </button>
          {/if}
          <button
            class="block-action block-action-remove"
            on:click={(e) => handleRemove(e, block)}
            on:mousedown|stopPropagation
            title="Remove"
            aria-label="Remove {block.title}"
          >
            X
          </button>
        </div>
      </div>
    {/each}

    {#if isDraggingOver}
      <div class="drop-indicator">
        Drop to plan this task
      </div>
    {/if}
    {#if selectionHint && !isDraggingOver}
      <div class="selection-hint">
        {selectionHint}
      </div>
    {:else if flowHint && !isDraggingOver}
      <div class="flow-hint">
        {flowHint}
      </div>
    {/if}
  </div>
</div>

<style>
  .day-scheduler {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--surface-0);
    max-height: 600px;
    overflow-y: auto;
  }

  .timeline-column {
    border-right: 1px solid var(--border);
    background: var(--surface-1);
    position: sticky;
    left: 0;
    z-index: 10;
  }

  .timeline-hour {
    height: calc(60px * 1.2);
    min-height: 72px;
    display: flex;
    align-items: flex-start;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    position: relative;
  }

  .hour-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .period-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    opacity: 0.6;
    text-transform: capitalize;
    margin-left: 4px;
    font-weight: 400;
  }

  .scheduler-grid {
    position: relative;
    min-height: calc(24 * 60px * 1.2);
    background: var(--surface-0);
  }

  .scheduler-grid.is-dragging-over {
    background: var(--accent-light, rgba(59, 130, 246, 0.05));
    transition: background 150ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .scheduler-grid.is-dragging-over {
      transition: none;
    }
  }

  .scheduler-block {
    position: absolute;
    left: 8px;
    right: 8px;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: move;
    user-select: none;
    overflow: hidden;
    transition: box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease-out, top 200ms cubic-bezier(0.4, 0, 0.2, 1), height 200ms cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 5;
  }

  @media (prefers-reduced-motion: no-preference) {
    .scheduler-block.newly-added {
      animation: blockGlow 1.5s ease-out;
    }

    .scheduler-block.resize-overshoot {
      animation: resizeOvershoot 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  }

  .scheduler-block.has-event-conflict {
    border: 2px solid rgba(239, 68, 68, 0.6);
    box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3);
  }

  .scheduler-block.selected {
    border: 2px solid var(--accent, #3b82f6);
    box-shadow: 0 0 0 2px var(--accent, #3b82f6), 0 0 12px rgba(59, 130, 246, 0.4);
    z-index: 7;
  }

  @keyframes blockGlow {
    0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
    50% { box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2); }
    100% { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }
  }

  @keyframes resizeOvershoot {
    0% { transform: scaleY(1); }
    50% { transform: scaleY(1.02); }
    100% { transform: scaleY(1); }
  }

  .scheduler-block:hover:not(.completed) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
    z-index: 6;
  }

  .scheduler-block:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.8);
    outline-offset: 2px;
  }

  .scheduler-block.resizing {
    cursor: ns-resize;
  }

  .scheduler-block.completed {
    opacity: 0.6;
    border-color: #4ade80;
    border-width: 2px;
    cursor: default;
  }

  .scheduler-block.completed .block-title {
    text-decoration: line-through;
  }

  .block-content {
    padding: 6px 10px;
    color: white;
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 100%;
    pointer-events: none;
  }

  .block-title {
    font-weight: 600;
    font-size: 0.85rem;
    line-height: 1.2;
  }

  .block-time {
    font-size: 0.7rem;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .time-period {
    font-size: 0.65rem;
    opacity: 0.7;
    text-transform: capitalize;
  }

  .block-resize-handle {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    background: rgba(255, 255, 255, 0.1);
    pointer-events: auto;
  }

  .block-resize-handle:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .block-actions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 4px;
    pointer-events: auto;
    opacity: 0;
    visibility: hidden;
    transition: opacity 150ms ease-out, visibility 150ms ease-out;
  }

  .block-actions.visible {
    opacity: 1;
    visibility: visible;
  }

  @media (prefers-reduced-motion: reduce) {
    .block-actions {
      transition: none;
    }
  }

  .block-action {
    min-width: 28px;
    height: 24px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: white;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
    line-height: 1;
    padding: 0 8px;
    transition: background 150ms ease-out, transform 150ms ease-out;
    font-weight: 600;
  }

  .block-action:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .block-action:hover {
      transform: scale(1.03);
    }
  }

  .block-action:hover {
    background: rgba(0, 0, 0, 0.72);
  }

  .block-action-complete:hover { background: rgba(74, 222, 128, 0.8); }
  .block-action-remove:hover { background: rgba(239, 68, 68, 0.8); }
  .block-action-focus:hover { background: rgba(59, 130, 246, 0.8); }
  .block-action-duplicate:hover { background: rgba(139, 92, 246, 0.8); }

  .planner-guide {
    position: sticky;
    top: 12px;
    margin: 12px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text-muted);
    font-size: 0.82rem;
    line-height: 1.4;
    z-index: 12;
  }

  .drop-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 12px 24px;
    background: var(--accent);
    color: white;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 500;
    pointer-events: none;
    z-index: 20;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .flow-hint,
  .selection-hint {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 12px;
    background: var(--surface-1);
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    pointer-events: none;
    z-index: 1;
    border: 1px solid var(--border);
    opacity: 0.9;
  }

  .selection-hint {
    background: var(--accent-light, rgba(59, 130, 246, 0.1));
    color: var(--accent-text, var(--text));
    border-color: var(--accent, #3b82f6);
    font-weight: 500;
  }
</style>

