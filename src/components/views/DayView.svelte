<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Event } from '../../lib/api';
  import { eventsStore } from '../../stores/eventsStore';
  import { hiddenCategoryIds } from '../../stores/categoryStore';
  import { scheduleStore } from '../../stores/scheduleStore';
  import { normalizeDate } from '../../lib/dates/safeDate';
  import { toastStore } from '../../stores/toastStore';
  import DayScheduler from '../planner/DayScheduler.svelte';
  import DailyReviewPanel from '../productivity/DailyReviewPanel.svelte';
  import { createShortcutHandler } from '../../lib/keyboard/shortcuts';
  import { getTimePeriodLabel } from '../../lib/dates/context';
  import { uiNavigationStore } from '../../stores/uiNavigationStore';
  import { focusStore } from '../../stores/focusStore';

  export let currentDate: Date | undefined = new Date();
  export let searchQuery = '';

  const dispatch = createEventDispatcher<{ selectEvent: Event; slot: Date; navigate: 'prev' | 'next' }>();

  let events: Event[] = [];
  let scheduleBlocks: any[] = [];
  let loading = false;
  let generating = false;
  let rangeStart: Date;
  let rangeEnd: Date;
  let unsubscribe: (() => void) | null = null;
  let scheduleUnsubscribe: (() => void) | null = null;
  let navigationUnsubscribe: (() => void) | null = null;
  let hiddenIds = new Set<number>();
  let focusModeEnabled = false;
  let isFocusedItem = false;

  focusStore.focusModeEnabled.subscribe((enabled) => { focusModeEnabled = enabled; });

  function handleNavigation(action: { type: string; target: Date | number | string } | null) {
    if (!action) return;
    isFocusedItem = action.type === 'task' || action.type === 'event' || action.type === 'block';
  }
  let safeDate = new Date();
  $: safeDate = normalizeDate(currentDate);

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const shortcuts = createShortcutHandler([
      {
        shortcut: { key: 'ArrowLeft' },
        handler: () => {
          e.preventDefault();
          dispatch('navigate', 'prev');
        },
      },
      {
        shortcut: { key: 'ArrowRight' },
        handler: () => {
          e.preventDefault();
          dispatch('navigate', 'next');
        },
      },
    ]);

    shortcuts(e);
  }

  function handleAutoScheduleSelectedDay() {
    window.dispatchEvent(new CustomEvent('auto-schedule-selected-day'));
  }

  onMount(() => {
    unsubscribe = eventsStore.subscribe(() => {
      if (rangeStart && rangeEnd) {
        events = eventsStore.eventsInRange(rangeStart, rangeEnd);
      }
    });
    scheduleUnsubscribe = scheduleStore.subscribe((blocks) => {
      scheduleBlocks = blocks;
    });
    const catUnsub = hiddenCategoryIds.subscribe((ids) => {
      hiddenIds = ids;
    });
    const autoScheduleHandler = () => handleAutoScheduleSelectedDay();
    window.addEventListener('auto-schedule-selected-day', autoScheduleHandler);
    navigationUnsubscribe = uiNavigationStore.subscribe(handleNavigation);
    const teardown = unsubscribe;
    unsubscribe = () => {
      teardown?.();
      catUnsub();
      scheduleUnsubscribe?.();
      window.removeEventListener('auto-schedule-selected-day', autoScheduleHandler);
      navigationUnsubscribe?.();
    };
    loadEvents();
    window.addEventListener('keydown', handleKeydown);
  });
  onDestroy(() => {
    unsubscribe?.();
    scheduleUnsubscribe?.();
    window.removeEventListener('keydown', handleKeydown);
  });
  $: safeDate && loadEvents();

  function dayRange(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async function loadEvents() {
    loading = true;
    const { start, end } = dayRange(safeDate);
    rangeStart = start;
    rangeEnd = end;
    await eventsStore.loadRange(start, end).catch(() => []);
    events = eventsStore.eventsInRange(start, end);
    loading = false;
  }

  $: filtered = events
    .filter((event) => event.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((event) => {
      if (!event.category_id) return true;
      return !hiddenIds.has(event.category_id);
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  $: slots = Array.from({ length: 24 }, (_, idx) => idx);

  function anchorHour(dateValue: string | Date): number {
    const date = new Date(dateValue);
    const dayStart = new Date(safeDate);
    dayStart.setHours(0, 0, 0, 0);
    const anchored = date < dayStart ? dayStart : date;
    return anchored.getHours();
  }

  function eventsForHour(hour: number): Event[] {
    return filtered.filter((event) => anchorHour(event.start_time) === hour);
  }

  function scheduleBlocksForHour(hour: number): any[] {
    return scheduleBlocks
      .filter((block) => anchorHour(block.start) === hour)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  async function handleGenerateSchedule() {
    generating = true;
    try {
      await scheduleStore.generateForDate(safeDate);
      toastStore.showSuccess('Schedule generated');
    } catch (err) {
      console.error('Failed to generate schedule', err);
      toastStore.showError('Could not generate schedule');
    } finally {
      generating = false;
    }
  }

  async function handleApplySchedule() {
    if (scheduleBlocks.length === 0) return;

    const taskBlocks = scheduleBlocks.filter((b) => b.type === 'task' && b.taskId);
    if (taskBlocks.length === 0) {
      toastStore.showError('No task blocks to apply');
      return;
    }

    try {
      let created = 0;
      for (const block of taskBlocks) {
        await eventsStore.create({
          title: block.label,
          start_time: block.start.toISOString(),
          end_time: block.end.toISOString(),
          source: 'schedule',
        });
        created++;
      }
      toastStore.showSuccess(`Created ${created} event${created !== 1 ? 's' : ''} from schedule`);
      scheduleStore.clear();
    } catch (err) {
      console.error('Failed to apply schedule', err);
      toastStore.showError('Could not apply schedule');
    }
  }

  function formatHourLabel(hour: number) {
    return new Date(safeDate.getFullYear(), safeDate.getMonth(), safeDate.getDate(), hour)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getEventTimeLabel(event: Event) {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function getBlockTimeLabel(block: any) {
    const start = new Date(block.start);
    const end = new Date(block.end);
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
</script>

<div class="view" class:focus-mode={focusModeEnabled} class:focused-item={isFocusedItem}>
  <div class="legend">
    <div>
      <h2>Day</h2>
      <p class="muted">Events, suggestions, and planner blocks for one day.</p>
    </div>
    <div class="legend-actions">
      {#if loading}<span class="pill">Loading...</span>{/if}
      <button class="btn-generate" on:click={handleGenerateSchedule} disabled={generating}>
        {generating ? 'Generating...' : 'Generate suggestions'}
      </button>
      {#if scheduleBlocks.length > 0}
        <button class="btn-apply" on:click={handleApplySchedule}>
          Create events from suggestions
        </button>
      {/if}
    </div>
  </div>
  <p class="view-note">Suggestions are temporary until you create events or turn tasks into planner blocks below.</p>
  <div class="timeline-container">
    <div class="timeline">
      {#each slots as hour}
        {@const slotEvents = eventsForHour(hour)}
        {@const hourBlocks = scheduleBlocksForHour(hour)}
        {@const period = getTimePeriodLabel(hour)}
        {@const showPeriod = hour === 0 || (hour > 0 && getTimePeriodLabel(hour - 1) !== period)}
        <div class="hour-slot">
          <div class="slot-head">
            <div class="time">
              {formatHourLabel(hour)}
              {#if showPeriod}
                <span class="period-label">{period}</span>
              {/if}
            </div>
            <button class="ghost tiny" on:click={() => dispatch('slot', new Date(safeDate.getFullYear(), safeDate.getMonth(), safeDate.getDate(), hour))}>
              Add
            </button>
          </div>

          {#if slotEvents.length === 0 && hourBlocks.length === 0}
            <p class="slot-empty">Nothing scheduled or suggested</p>
          {/if}

          {#each slotEvents as event}
            <button class="card" on:click={() => dispatch('selectEvent', event)}>
              <div>
                <strong>{event.title}</strong>
                <small>{getEventTimeLabel(event)}</small>
              </div>
            </button>
          {/each}

          {#each hourBlocks as block}
            <div class="schedule-card schedule-card-{block.type} priority-{block.priority || 'normal'}" title="{block.label} ({getBlockTimeLabel(block)})">
              <span class="schedule-label">{block.label}</span>
              <span class="schedule-time">{getBlockTimeLabel(block)}</span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <DailyReviewPanel selectedDate={safeDate} />

  <div class="scheduler-section">
    <p class="scheduler-copy">Planner blocks are your day plan. Drag tasks into the planner, move blocks, or resize them to fit the day.</p>
    <h3 class="scheduler-title">Daily Scheduler</h3>
    <DayScheduler {currentDate} />
  </div>
</div>

<style>
  .view { display: grid; gap: 12px; animation: fadeSlide 160ms ease; }
  .legend { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .legend-actions { display: flex; gap: 8px; align-items: center; }
  .muted { color: var(--text-muted); margin: 0; }
  .view-note {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.88rem;
  }

  .timeline-container { position: relative; }
  .timeline { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
  .hour-slot {
    background: var(--surface-0);
    border: 1px solid var(--grid-line, var(--border));
    border-radius: var(--radius-md);
    padding: 12px;
    box-shadow: var(--shadow-sm);
    display: grid;
    gap: 8px;
    min-height: 150px;
  }
  .slot-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .time {
    color: var(--text-muted);
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .period-label {
    font-size: 0.7rem;
    opacity: 0.6;
    text-transform: capitalize;
    font-weight: 400;
  }
  .slot-empty {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .card {
    display: grid;
    gap: 4px;
    align-items: center;
    text-align: left;
    background: var(--surface-1);
    border: 1px solid var(--grid-line, var(--border));
    border-radius: var(--radius-md);
    padding: 12px;
    box-shadow: var(--shadow-sm);
    color: var(--text);
    cursor: pointer;
    transition: box-shadow 140ms ease, transform 140ms ease, border-color 140ms ease;
  }
  .card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); border-color: var(--border-light); }
  .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .card small { color: var(--text-muted); }
  .ghost {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px;
    background: var(--surface-1);
    color: var(--text);
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease;
  }
  .ghost:hover { background: var(--surface-0); border-color: var(--border-light); }
  .ghost.tiny {
    padding: 6px 10px;
    font-size: 0.85rem;
  }
  .pill { padding: 6px 10px; background: var(--accent-light, var(--surface-0)); border-radius: var(--radius-sm); color: var(--text); border: 1px solid var(--border-light); }

  .btn-generate, .btn-apply {
    padding: 8px 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-0);
    color: var(--text);
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 140ms ease, border-color 140ms ease;
  }
  .btn-generate:hover:not(:disabled), .btn-apply:hover {
    background: var(--surface-1);
    border-color: var(--border-light);
  }
  .btn-generate:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-apply {
    background: var(--accent);
    color: var(--accent-text, white);
    border-color: var(--accent);
  }
  .btn-apply:hover {
    background: var(--accent-hover, var(--accent));
    opacity: 0.9;
  }

  .schedule-card {
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 30px;
    overflow: hidden;
  }

  .schedule-card-task {
    background: var(--accent);
    color: var(--accent-text, white);
    border: 1px solid var(--accent);
  }
  .schedule-card-task.priority-urgent {
    background: #dc2626;
    border-color: #dc2626;
  }
  .schedule-card-task.priority-high {
    background: #ea580c;
    border-color: #ea580c;
  }
  .schedule-card-task.priority-normal {
    background: var(--accent);
    border-color: var(--accent);
  }
  .schedule-card-task.priority-low {
    background: #6b7280;
    border-color: #6b7280;
  }

  .schedule-card-break {
    background: var(--surface-1);
    border: 1px dashed var(--border);
    color: var(--text-muted);
  }

  .schedule-card-buffer {
    background: transparent;
    border: 1px dotted var(--border);
    color: var(--text-muted);
  }

  .schedule-label {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .schedule-time {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .scheduler-section {
    margin-top: 24px;
    display: grid;
    gap: 12px;
  }

  .scheduler-copy {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.88rem;
  }

  .scheduler-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
  }

  .view.focus-mode {
    --grid-line-opacity: 0.3;
  }

  .view.focus-mode .card small,
  .view.focus-mode .schedule-time,
  .view.focus-mode .period-label {
    opacity: 0.5;
  }

  .view.focused-item .card:has([data-focused]),
  .view.focused-item .schedule-card[data-focused] {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
  }

  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>






