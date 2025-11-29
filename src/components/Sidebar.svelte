<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { listCategories, type Category } from '../lib/api';
  import { settingsStore, type ThemeName } from '../stores/settings';
  import { loadTheme, type Theme } from '../lib/theme';
  import ThemePreview from './ThemePreview.svelte';
  import { onMount } from 'svelte';

  const dispatch = createEventDispatcher<{
    dateSelect: Date;
    categoryToggle: number;
    themeSelect: ThemeName;
  }>();

  let categories: Category[] = [];
  let selectedDate = new Date();
  let currentMonth = new Date();
  let visibleCategories = new Set<number>();
  let themes: ThemeName[] = ['light', 'dark', 'glassmorphism', 'avant-garde', 'brutalism', 'yeezy-minimal'];

  onMount(async () => {
    await loadCategories();
    // Load visibility from settings
    categories.forEach(cat => {
      if (cat.id) visibleCategories.add(cat.id);
    });
  });

  async function loadCategories() {
    try {
      categories = await listCategories();
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  function handleDateClick(day: number) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    selectedDate = date;
    dispatch('dateSelect', date);
  }

  function handleCategoryToggle(categoryId: number) {
    if (visibleCategories.has(categoryId)) {
      visibleCategories.delete(categoryId);
    } else {
      visibleCategories.add(categoryId);
    }
    dispatch('categoryToggle', categoryId);
  }

  function handleThemeSelect(themeName: string) {
    dispatch('themeSelect', themeName as ThemeName);
  }

  function previousMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  }

  function nextMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  $: daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  $: firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  $: monthName = monthNames[currentMonth.getMonth()];
  $: year = currentMonth.getFullYear();

  $: days = (() => {
    const daysArray: (number | null)[] = [];
    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      daysArray.push(null);
    }
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      daysArray.push(i);
    }
    return daysArray;
  })();

  function isToday(day: number | null): boolean {
    if (day === null) return false;
    const today = new Date();
    return day === today.getDate() &&
           currentMonth.getMonth() === today.getMonth() &&
           currentMonth.getFullYear() === today.getFullYear();
  }

  function isSelected(day: number | null): boolean {
    if (day === null) return false;
    return day === selectedDate.getDate() &&
           currentMonth.getMonth() === selectedDate.getMonth() &&
           currentMonth.getFullYear() === selectedDate.getFullYear();
  }
</script>

<div class="sidebar">
  <!-- Mini Calendar -->
  <section class="sidebar-section">
    <div class="mini-calendar-header">
      <button class="calendar-nav" on:click={previousMonth} aria-label="Previous month">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M12 15L7 10L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <h3 class="calendar-title">{monthName} {year}</h3>
      <button class="calendar-nav" on:click={nextMonth} aria-label="Next month">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M8 5L13 10L8 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <div class="mini-calendar">
      <div class="weekday-header">
        {#each weekDays as day}
          <div class="weekday">{day}</div>
        {/each}
      </div>
      
      <div class="calendar-grid">
        {#each days as day}
          <button
            class="calendar-day"
            class:empty={day === null}
            class:today={day !== null && isToday(day)}
            class:selected={day !== null && isSelected(day)}
            on:click={() => day !== null && handleDateClick(day)}
            disabled={day === null}
          >
            {day}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <!-- Categories -->
  <section class="sidebar-section">
    <h3 class="section-title">Categories</h3>
    <div class="categories-list">
      {#each categories as category}
        <div class="category-item">
          <button
            class="category-toggle"
            class:visible={visibleCategories.has(category.id || 0)}
            on:click={() => handleCategoryToggle(category.id || 0)}
            style:--category-color={category.color}
          >
            <div class="category-indicator" style:background={category.color}></div>
            <span class="category-name">{category.name}</span>
          </button>
        </div>
      {/each}
      {#if categories.length === 0}
        <p class="empty-state">No categories yet</p>
      {/if}
    </div>
  </section>

  <!-- Theme Selector -->
  <section class="sidebar-section">
    <h3 class="section-title">Theme</h3>
    <div class="themes-list">
      {#each themes as themeName}
        <ThemePreview
          themeName={themeName}
          selected={$settingsStore.theme === themeName}
          onSelect={handleThemeSelect}
        />
      {/each}
    </div>
  </section>
</div>

<style>
  .sidebar {
    width: var(--sidebar-width, 280px);
    height: calc(100vh - var(--topbar-height, 64px));
    background: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    overflow-y: auto;
    padding: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
  }

  .sidebar-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .section-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
  }

  /* Mini Calendar */
  .mini-calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  .calendar-nav {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--button-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .calendar-nav:hover {
    background: var(--button-hover);
  }

  .calendar-title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text);
    margin: 0;
  }

  .mini-calendar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-xs);
  }

  .weekday {
    text-align: center;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--text-muted);
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--spacing-xs);
  }

  .calendar-day {
    aspect-ratio: 1;
    min-width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-normal);
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .calendar-day:not(.empty):hover {
    background: var(--bg-hover);
    border-color: var(--border);
  }

  .calendar-day.today {
    background: var(--accent);
    color: white;
    font-weight: var(--font-weight-semibold);
  }

  .calendar-day.selected:not(.today) {
    background: var(--accent-light);
    border-color: var(--accent);
    color: var(--accent);
    font-weight: var(--font-weight-semibold);
  }

  .calendar-day.empty {
    cursor: default;
    opacity: 0;
  }

  .calendar-day:disabled {
    cursor: default;
  }

  /* Categories */
  .categories-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .category-item {
    display: flex;
    align-items: center;
  }

  .category-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--button-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .category-toggle:hover {
    background: var(--button-hover);
    transform: translateX(2px);
  }

  .category-toggle.visible {
    background: var(--accent-light);
    border-color: var(--accent);
  }

  .category-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .category-name {
    flex: 1;
    text-align: left;
  }

  .empty-state {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-align: center;
    padding: var(--spacing-lg);
  }

  /* Themes */
  .themes-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
</style>

