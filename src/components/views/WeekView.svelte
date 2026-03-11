<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Event } from '../../lib/api';
  import { eventsStore } from '../../stores/eventsStore';
  import { hiddenCategoryIds } from '../../stores/categoryStore';
  import { normalizeDate } from '../../lib/dates/safeDate';
  import WeekReviewPanel from '../productivity/WeekReviewPanel.svelte';
  import { plannedEventsStore } from '../../stores/plannedEventsStore';
  import { toastStore } from '../../stores/toastStore';
  import { autoScheduleTask } from '../../lib/scheduler/autoScheduler';
  import { uiNavigationStore } from '../../stores/uiNavigationStore';
  import { loadAutoScheduleOptionsForDate, loadTasksForDateRange } from '../../lib/scheduler/schedulerContext';

  export let currentDate: Date | undefined = new Date();
  export let searchQuery = '';

  const dispatch = createEventDispatcher<{ selectEvent: Event; slot: Date }>();

  let events: Event[] = [];
  let loading = false;
  let rangeStart: Date;
  let rangeEnd: Date;
  let unsubscribe: (() => void) | null = null;
  let hiddenIds = new Set<number>();
  let safeDate = new Date();
  $: safeDate = normalizeDate(currentDate);

  function startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  $: weekStart = startOfWeek(safeDate);
  $: weekDaysDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  $: plannerOverview = weekDaysDates.map((day) => {
    const blocks = plannedEventsStore.blocksForDate(day);
    const totalMinutes = blocks.reduce((sum, block) => {
      const duration = (block.end.getTime() - block.start.getTime()) / (1000 * 60);
      return sum + duration;
    }, 0);
    return {
      day,
      blocksCount: blocks.length,
      totalMinutes,
    };
  });

  $: filtered = events
    .filter((event) => event.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((event) => {
      if (!event.category_id) return true;
      return !hiddenIds.has(event.category_id);
    });

  function handleAutoScheduleSelectedDay() {
    window.dispatchEvent(new CustomEvent('auto-schedule-selected-day'));
  }

  async function handleAutoScheduleWeek() {
    const freshTasks = await loadTasksForDateRange(weekDaysDates[0], weekDaysDates[weekDaysDates.length - 1]);
    const weekDateTimes = weekDaysDates.map((d) => normalizeDate(d).getTime());
    const urgentHighTasks = freshTasks.filter((task) => {
      if (task.done) return false;
      if (!task.date) return false;
      const taskDateTime = normalizeDate(task.date).getTime();
      if (!weekDateTimes.includes(taskDateTime)) return false;
      return task.priority === 'urgent' || task.priority === 'high';
    });

    if (urgentHighTasks.length === 0) {
      toastStore.showInfo('No urgent or high priority tasks for this week');
      return;
    }

    let totalScheduled = 0;
    let totalFailed = 0;

    for (const day of weekDaysDates) {
      const dayTime = normalizeDate(day).getTime();
      const dayTasks = urgentHighTasks.filter((task) => {
        if (!task.date) return false;
        return normalizeDate(task.date).getTime() === dayTime;
      });

      if (dayTasks.length === 0) continue;

      const existingBlocks = plannedEventsStore.blocksForDate(day);
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
          return aPriority - bPriority;
        })
        .slice(0, 2);

      const currentBlocks = [...existingBlocks];
      let dayScheduled = 0;
      let dayFailed = 0;
      const options = await loadAutoScheduleOptionsForDate(day);

      for (const task of unscheduledTasks) {
        const plannedEvent = autoScheduleTask(task, day, currentBlocks, options);
        if (plannedEvent) {
          try {
            plannedEventsStore.addBlock(plannedEvent);
            currentBlocks.push({ ...plannedEvent, id: 'temp' });
            dayScheduled++;
          } catch {
            dayFailed++;
          }
        } else {
          dayFailed++;
        }
      }

      totalScheduled += dayScheduled;
      totalFailed += dayFailed;
    }

    if (totalScheduled > 0) {
      toastStore.showSuccess(
        `Scheduled ${totalScheduled} task${totalScheduled !== 1 ? 's' : ''} across the week${totalFailed > 0 ? `. ${totalFailed} could not be scheduled` : ''}`
      );
    } else {
      toastStore.showError('No free time slots available for this week');
    }
  }

  function handleNavigation(action: { type: string; target: Date | number | string } | null) {
    if (!action) return;
    if (action.type === 'date' && action.target instanceof Date) {
      currentDate = action.target;
    }
  }

  let navigationUnsubscribe: (() => void) | null = null;

  onMount(() => {
    unsubscribe = eventsStore.subscribe(() => {
      if (rangeStart && rangeEnd) {
        events = eventsStore.eventsInRange(rangeStart, rangeEnd);
      }
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
      window.removeEventListener('auto-schedule-selected-day', autoScheduleHandler);
      navigationUnsubscribe?.();
    };
    loadEvents();
  });
  onDestroy(() => {
    unsubscribe?.();
    navigationUnsubscribe?.();
  });
  $: safeDate && loadEvents();

  function weekRange(start: Date) {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  async function loadEvents() {
    loading = true;
    const { start, end } = weekRange(weekStart);
    rangeStart = start;
    rangeEnd = end;
    await eventsStore.loadRange(start, end).catch(() => []);
    events = eventsStore.eventsInRange(start, end);
    loading = false;
  }

  function eventsForDay(day: Date) {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return filtered.filter((event) => {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      return start <= dayEnd && end >= dayStart;
    });
  }

  const isAllDay = (event: Event) => {
    if (event.all_day) return true;
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const duration = end.getTime() - start.getTime();
    return duration >= 24 * 60 * 60 * 1000;
  };
</script>

<div class="view">
  <div class="legend">
    <div>
      <h2>Week</h2>
      <p class="muted">Events this week and a planning overview by day.</p>
    </div>
    {#if loading}<span class="pill">Loading...</span>{/if}
  </div>
  <div class="week-grid">
    {#each weekDaysDates as day}
      <div class="day">
        <div class="heading">
          <div>
            <p class="muted">{day.toLocaleDateString('en-US', { weekday: 'short' })}
            <span class="planner-day-action">Open day plan</span></p>
            <strong>{day.getDate()}</strong>
          </div>
          <button class="ghost tiny" on:click={() => dispatch('slot', day)}>Add event</button>
        </div>
        <div class="stack">
          {#if eventsForDay(day).length === 0}
            <p class="day-empty">No events planned</p>
          {/if}
          {#each eventsForDay(day) as event}
            <button class="card" on:click={() => dispatch('selectEvent', event)}>
              <div class="dot"></div>
              <div>
                <span class="title">{event.title}</span>
                {#if isAllDay(event)}
                  <small>All day</small>
                {:else}
                  <small>
                    {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    -
                    {new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </small>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="planner-overview">
    <div class="planner-header">
      <h3>Week planning</h3>
      <p class="planner-copy">Review each day, then open a day plan to add or adjust blocks.</p>
      <button class="btn-auto-schedule" on:click={handleAutoScheduleWeek}>
        Auto-schedule tasks
      </button>
    </div>
    <div class="planner-days">
      {#each plannerOverview as overview, index}
        {@const day = weekDaysDates[index]}
        <button
          class="planner-day"
          on:click={() => dispatch('slot', day)}
          title="Open this day plan"
        >
          <div class="planner-day-label">
            {day.toLocaleDateString('en-US', { weekday: 'short' })}
            <span class="planner-day-action">Open day plan</span>
          </div>
          <div class="planner-day-stats">
            <span class="blocks-count">{overview.blocksCount} blocks</span>
            <span class="minutes-count">{Math.round(overview.totalMinutes / 60 * 10) / 10}h</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
  
  <WeekReviewPanel weekStart={weekStart} selectedDate={safeDate} />
</div>

<style>
  .view { display: grid; gap: 12px; animation: fadeSlide 160ms ease; }
  .legend { display: flex; align-items: center; justify-content: space-between; }
  .muted { color: var(--text-muted); margin: 0; }
  .week-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
  .day {
    background: var(--surface-0);
    border: 1px solid var(--grid-line, var(--border));
    border-radius: var(--radius-lg);
    padding: 12px;
    box-shadow: var(--shadow-sm);
    display: grid;
    gap: 10px;
  }
  .heading { display: flex; justify-content: space-between; align-items: center; }
  .heading strong { font-size: 1.25rem; color: var(--text); }
  .stack { display: grid; gap: 10px; }
  .day-empty { margin: 0; color: var(--text-muted); font-size: 0.85rem; }
  .card {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
    border: 1px solid var(--border);
    background: var(--surface-1);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    color: var(--text);
    cursor: pointer;
    transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
  }
  .card:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); background: var(--surface-0); }
  .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .card .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--accent); box-shadow: var(--shadow-xs); }
  .card small { color: var(--text-muted); display: block; }
  .ghost.tiny {
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease;
  }
  .ghost.tiny:hover { background: var(--surface-0); border-color: var(--border-light); }
  .pill { padding: 6px 10px; background: var(--accent-light, var(--surface-0)); border-radius: var(--radius-sm); color: var(--text); border: 1px solid var(--border-light); }

  .planner-overview {
    margin-top: 16px;
    padding: 16px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .planner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .planner-copy {
    margin: 4px 0 0;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .planner-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .btn-auto-schedule {
    padding: 6px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--accent);
    color: var(--accent-text, white);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 150ms ease-out, opacity 150ms ease-out;
  }

  .btn-auto-schedule:hover {
    background: var(--accent-hover, var(--accent));
    opacity: 0.9;
  }

  .btn-auto-schedule:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .planner-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
  }

  .planner-day {
    padding: 10px;
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 150ms ease-out, border-color 150ms ease-out, transform 150ms ease-out;
    text-align: center;
  }

  .planner-day:hover {
    background: var(--surface-1);
    border-color: var(--border-light);
    transform: translateY(-1px);
  }

  .planner-day:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .planner-day-action {
    display: block;
    margin-top: 4px;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .planner-day-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 6px;
    font-weight: 500;
  }

  .planner-day-stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--text);
  }

  .blocks-count {
    font-weight: 600;
  }

  .minutes-count {
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
