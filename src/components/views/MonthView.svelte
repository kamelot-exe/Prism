<script lang="ts">
  import { onMount } from 'svelte';
  import { getEvents, type Event } from '../../lib/api';
  import { settingsStore } from '../../stores/settings';
  import EventModal from '../EventModal.svelte';
  import QuickAddModal from '../QuickAddModal.svelte';
  import ThemedCard from '../ThemedCard.svelte';
  import { loadTheme, type Theme } from '../../lib/theme';

  let events: Event[] = [];
  let currentDate = new Date();
  let loading = false;
  let error: string | null = null;
  let selectedEvent: Event | null = null;
  let isEventModalOpen = false;
  let isQuickAddOpen = false;
  let quickAddDate: Date | undefined;
  let theme: Theme | null = null;

  $: if ($settingsStore.theme) {
    loadThemeData();
  }

  async function loadThemeData() {
    try {
      const themeName = $settingsStore.theme === 'auto' 
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : $settingsStore.theme;
      theme = await loadTheme(themeName as any);
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Monday = 0

  const days: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  onMount(async () => {
    await loadEvents();
  });

  async function loadEvents() {
    loading = true;
    error = null;
    try {
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      events = await getEvents(startDate, endDate);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load events';
    } finally {
      loading = false;
    }
  }

  function getEventsForDay(day: number | null): Event[] {
    if (day === null) return [];
    const dayDate = new Date(year, month, day);
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.getDate() === day && 
             eventDate.getMonth() === month && 
             eventDate.getFullYear() === year;
    });
  }

  function previousMonth() {
    currentDate = new Date(year, month - 1, 1);
    loadEvents();
  }

  function nextMonth() {
    currentDate = new Date(year, month + 1, 1);
    loadEvents();
  }

  function handleEventClick(event: Event) {
    selectedEvent = event;
    isEventModalOpen = true;
  }

  function handleDayClick(day: number | null) {
    if (day !== null) {
      quickAddDate = new Date(year, month, day);
      isQuickAddOpen = true;
    }
  }

  function handleEventSave(event: CustomEvent<Event>) {
    // TODO: Implement save event
    console.log('Save event:', event.detail);
    loadEvents();
  }

  function handleQuickAdd(event: CustomEvent<{ title: string; date: Date; categoryId: number | null }>) {
    // TODO: Implement quick add
    console.log('Quick add:', event.detail);
    loadEvents();
  }

  function getEventColor(event: Event): string {
    if (event.category && event.category.color) {
      return $settingsStore.getCategoryColor(event.category.id || 0, event.category.color);
    }
    return 'var(--accent-color, #3b82f6)';
  }

  function isToday(day: number): boolean {
    const today = new Date();
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear();
  }
</script>

<div class="month-view">
  <div class="month-header">
    <button class="nav-button" on:click={previousMonth}>←</button>
    <h2>{monthNames[month]} {year}</h2>
    <div class="header-actions">
      <button class="action-button" on:click={() => { quickAddDate = new Date(); isQuickAddOpen = true; }}>
        + Quick Add
      </button>
      <button class="nav-button" on:click={nextMonth}>→</button>
    </div>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if theme}
    <ThemedCard theme={theme} elevation="md" class="calendar-grid">
    <div class="weekday-header">
      {#each weekDays as day}
        <div class="weekday">{day}</div>
      {/each}
    </div>

    <div class="calendar-days">
      {#each days as day}
        <div
          class="calendar-day"
          class:empty={day === null}
          class:today={day !== null && isToday(day)}
          on:click={() => handleDayClick(day)}
          role="button"
          tabindex={day !== null ? 0 : -1}
        >
          {#if day !== null}
            <div class="day-number">{day}</div>
            <div class="day-events">
              {#each getEventsForDay(day) as event}
                <div
                  class="event-item"
                  style="background-color: {getEventColor(event)};"
                  on:click={() => handleEventClick(event)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && handleEventClick(event)}
                >
                  {event.title}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    </ThemedCard>
  {/if}
</div>

{#if theme}
  <EventModal
    bind:isOpen={isEventModalOpen}
    event={selectedEvent}
    on:close={() => { selectedEvent = null; isEventModalOpen = false; }}
    on:save={handleEventSave}
  />

  <QuickAddModal
    bind:isOpen={isQuickAddOpen}
    defaultDate={quickAddDate}
    on:close={() => { isQuickAddOpen = false; quickAddDate = undefined; }}
    on:create={handleQuickAdd}
  />
{/if}

<style>
  .month-view {
    max-width: 1200px;
    margin: 0 auto;
  }

  .month-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .action-button {
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: var(--border-radius-md, 0.5rem);
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: var(--font-weight-medium, 500);
    transition: all 0.2s;
  }

  .action-button:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .month-header h2 {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-primary);
  }

  .nav-button {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 1rem;
    transition: all 0.2s;
  }

  .nav-button:hover {
    background: var(--bg-hover);
  }

  .error {
    background: var(--error-color);
    color: white;
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .calendar-grid {
    overflow: hidden;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: var(--bg-hover);
    border-bottom: 1px solid var(--border-color);
  }

  .weekday {
    padding: 0.75rem;
    text-align: center;
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  .calendar-day {
    min-height: 120px;
    border-right: 1px solid var(--border-color);
    border-bottom: 1px solid var(--border-color);
    padding: 0.5rem;
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
  }

  .calendar-day:hover:not(.empty) {
    background: var(--bg-hover);
  }

  .calendar-day.empty {
    background: var(--bg-secondary);
    cursor: default;
  }

  .calendar-day.today .day-number {
    background: var(--accent-color);
    color: white;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: var(--font-weight-bold, 700);
  }

  .calendar-day:nth-child(7n) {
    border-right: none;
  }

  .day-number {
    font-weight: 600;
    margin-bottom: 0.25rem;
    color: var(--text-primary);
  }

  .day-events {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .event-item {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius-sm, 0.375rem);
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: var(--font-weight-medium, 500);
  }

  .event-item:hover {
    opacity: 0.9;
    transform: translateX(2px);
    box-shadow: var(--shadow-sm);
  }

  .event-item:focus {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }
</style>

