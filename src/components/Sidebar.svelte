<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Category } from '../lib/api';
  import { categoryStore } from '../stores/categoryStore';
  import TodoPanel from './productivity/TodoPanel.svelte';
  import SummaryPanel from './productivity/SummaryPanel.svelte';
  import Pomodoro from './productivity/Pomodoro.svelte';
  import WeeklyGoalsCard from './productivity/WeeklyGoalsCard.svelte';
  import WeeklyPlanCard from './productivity/WeeklyPlanCard.svelte';
  import { normalizeDate } from '../lib/dates/safeDate';

  export let currentDate: Date | undefined = new Date();
  export let isHovered = false;

  const dispatch = createEventDispatcher<{ dateSelect: Date; hoverChange: boolean }>();

  function handleMouseEnter() {
    dispatch('hoverChange', true);
  }

  function handleMouseLeave() {
    dispatch('hoverChange', false);
  }

  let categories: Category[] = [];
  let hiddenCategories = new Set<number>();
  let safeDate = new Date();
  $: safeDate = normalizeDate(currentDate);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekdayHeads = ['Mo','Tu','We','Th','Fr','Sa','Su'];

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstWeekday = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  $: monthLabel = `${months[safeDate.getMonth()]} ${safeDate.getFullYear()}`;

  $: calendarCells = (() => {
    const totalDays = daysInMonth(safeDate);
    const startOffset = firstWeekday(safeDate);
    return Array.from({ length: startOffset + totalDays }, (_, idx) => {
      if (idx < startOffset) return null;
      return idx - startOffset + 1;
    });
  })();

  onMount(() => {
    const unsub = categoryStore.subscribe((cats) => {
      categories = cats;
    });
    const unsubHidden = categoryStore.hiddenCategoryIds.subscribe((ids) => (hiddenCategories = ids));
    (async () => {
      await categoryStore.loadCategories();
    })();
    return () => {
      unsub();
      unsubHidden();
    };
  });

  function selectDay(day: number) {
    const next = new Date(safeDate);
    next.setDate(day);
    dispatch('dateSelect', next);
  }

  function jumpToMonth(monthIndex: number) {
    const next = new Date(safeDate);
    next.setMonth(monthIndex, Math.min(safeDate.getDate(), daysInMonth(new Date(safeDate.getFullYear(), monthIndex + 1, 0))));
    dispatch('dateSelect', next);
  }

  function toggleCategory(categoryId: number | undefined) {
    if (!categoryId) return;
    categoryStore.toggleCategoryVisibility(categoryId);
  }
</script>

<aside 
  class="sidebar surface" 
  class:visible={isHovered}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <section class="panel">
    <header>
      <div>
        <p class="eyebrow">Calendar</p>
        <h3>{monthLabel}</h3>
      </div>
      <div class="month-grid">
        {#each months as label, idx}
          <button class:active={idx === safeDate.getMonth()} on:click={() => jumpToMonth(idx)}>{label}</button>
        {/each}
      </div>
    </header>

    <div class="mini-calendar">
      <div class="weekday-row">
        {#each weekdayHeads as wd}<span>{wd}</span>{/each}
      </div>
      <div class="calendar-grid">
        {#each calendarCells as day}
          {#if day === null}
            <div></div>
          {:else}
            <button
              class="day"
              class:today={day === new Date().getDate() && safeDate.getMonth() === new Date().getMonth() && safeDate.getFullYear() === new Date().getFullYear()}
              class:active={day === safeDate.getDate()}
              on:click={() => selectDay(day)}
            >
              {day}
            </button>
          {/if}
        {/each}
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Categories</p>
        <h4>Color-coded focus</h4>
      </div>
      <span class="count">{categories.length}</span>
    </div>
    <div class="category-list">
      {#if categories.length === 0}
        <p class="muted">No categories yet. Add them in Settings > Categories.</p>
      {:else}
        {#each categories as category}
          <div class="category-row" style={`--category-color:${category.color_hex || category.color}`}>
            <span class="dot"></span>
            <div>
              <strong>{category.name}</strong>
              <small>{category.color_hex}</small>
            </div>
            <button
              class="ghost tiny toggle"
              aria-label="Toggle category visibility"
              class:muted-toggle={category.id && hiddenCategories.has(category.id)}
              on:click={() => toggleCategory(category.id)}
            >
              {#if category.id && hiddenCategories.has(category.id)}
                Show
              {:else}
                Hide
              {/if}
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </section>

  <section class="panel">
    <TodoPanel selectedDate={safeDate} />
  </section>

  <section class="panel">
    <SummaryPanel selectedDate={safeDate} />
  </section>

  <section class="panel">
    <Pomodoro />
  </section>

  <section class="panel">
    <WeeklyGoalsCard {currentDate} />
  </section>

  <section class="panel">
    <WeeklyPlanCard {currentDate} />
  </section>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    height: calc(100vh - var(--topbar-height) - 12px);
    position: fixed;
    left: 0;
    top: calc(var(--topbar-height) + 6px);
    display: grid;
    gap: 14px;
    padding: 14px;
    overflow-y: auto;
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
    box-shadow: var(--shadow-lg);
    z-index: 50;
    transform: translateX(-100%);
    opacity: 0;
    visibility: hidden;
    transition: transform 200ms ease, opacity 200ms ease, visibility 200ms ease;
    pointer-events: none;
  }

  .sidebar.visible {
    transform: translateX(0);
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .panel {
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 14px;
    box-shadow: var(--shadow-sm);
    display: grid;
    gap: 12px;
  }

  header { display: grid; gap: 0.65rem; }
  h3, h4 { margin: 0; color: var(--text); }
  .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; color: var(--text-muted); }
  .muted { color: var(--text-muted); margin: 0; }

  .month-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }
  .month-grid button {
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    padding: 8px 6px;
    cursor: pointer;
    transition: all 140ms ease;
  }
  .month-grid button:hover { background: var(--surface-0); color: var(--text); box-shadow: var(--shadow-sm); }
  .month-grid button.active { background: var(--accent-light, var(--surface-0)); color: var(--text); border-color: var(--border-light); }

  .mini-calendar { display: grid; gap: 0.4rem; }
  .weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.35rem; color: var(--text-muted); font-size: 0.8rem; letter-spacing: 0.01em; }
  .weekday-row span { text-align: center; }
  .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .day {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    cursor: pointer;
    transition: all 140ms ease;
  }
  .day:hover { background: var(--surface-0); box-shadow: var(--shadow-sm); }
  .day.today { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); background: var(--accent-light, var(--surface-0)); }
  .day.active { background: var(--accent-light, var(--surface-0)); box-shadow: 0 0 0 1px var(--border-light) inset; }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .count {
    background: var(--surface-1);
    border: 1px solid var(--border);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    color: var(--text);
    box-shadow: var(--shadow-xs);
  }

  .category-list { display: grid; gap: 0.5rem; }
  .category-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    box-shadow: var(--shadow-xs);
    transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-xs);
    background: var(--category-color, var(--accent));
  }
  .category-row strong { display: block; color: var(--text); letter-spacing: 0.01em; }
  .category-row small { color: var(--text-muted); }
  .category-row:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); border-color: var(--border-light); }

  .ghost.tiny {
    border-radius: 10px;
    padding: 6px 10px;
    font-size: 0.9rem;
    background: var(--surface-1);
    border: 1px solid var(--border);
    color: var(--text);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }
  .ghost.tiny:hover { background: var(--surface-0); border-color: var(--border-light); }
  .toggle.muted-toggle { opacity: 0.65; }
</style>
