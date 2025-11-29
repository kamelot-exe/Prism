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

  const hours = Array.from({ length: 24 }, (_, i) => i);

  function getWeekDates(date: Date): Date[] {
    const week: Date[] = [];
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      week.push(day);
    }
    return week;
  }

  $: weekDates = getWeekDates(currentDate);

  onMount(async () => {
    await loadEvents();
  });

  async function loadEvents() {
    loading = true;
    error = null;
    try {
      const startDate = new Date(weekDates[0]);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(weekDates[6]);
      endDate.setHours(23, 59, 59, 999);
      events = await getEvents(startDate.toISOString(), endDate.toISOString());
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load events';
    } finally {
      loading = false;
    }
  }

  function getEventsForDayAndHour(day: Date, hour: number): Event[] {
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.getDate() === day.getDate() &&
             eventDate.getMonth() === day.getMonth() &&
             eventDate.getFullYear() === day.getFullYear() &&
             eventDate.getHours() === hour;
    });
  }

  function previousWeek() {
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() - 7);
    loadEvents();
  }

  function nextWeek() {
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 7);
    loadEvents();
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function handleEventClick(event: Event) {
    selectedEvent = event;
    isEventModalOpen = true;
  }

  function handleCellClick(day: Date, hour: number) {
    const date = new Date(day);
    date.setHours(hour, 0, 0, 0);
    quickAddDate = date;
    isQuickAddOpen = true;
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

  function isToday(day: Date): boolean {
    const today = new Date();
    return day.getDate() === today.getDate() &&
           day.getMonth() === today.getMonth() &&
           day.getFullYear() === today.getFullYear();
  }
</script>

<div class="week-view">
  <div class="week-header">
    <button class="nav-button" on:click={previousWeek}>←</button>
    <h2>
      {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
    </h2>
    <div class="header-actions">
      <button class="action-button" on:click={() => { quickAddDate = new Date(); isQuickAddOpen = true; }}>
        + Quick Add
      </button>
      <button class="nav-button" on:click={nextWeek}>→</button>
    </div>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if theme}
    <ThemedCard theme={theme} elevation="md" class="week-grid">
    <div class="time-column">
      <div class="time-header"></div>
      {#each hours as hour}
        <div class="time-cell">{hour}:00</div>
      {/each}
    </div>

    {#each weekDates as day}
      <div class="day-column">
        <div class="day-header" class:today={isToday(day)}>
          <div class="day-name">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <div class="day-number">{day.getDate()}</div>
        </div>
        {#each hours as hour}
          <div
            class="hour-cell"
            on:click={() => handleCellClick(day, hour)}
            role="button"
            tabindex="0"
          >
            {#each getEventsForDayAndHour(day, hour) as event}
              <div
                class="event-item"
                style="background-color: {getEventColor(event)};"
                on:click|stopPropagation={() => handleEventClick(event)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && handleEventClick(event)}
              >
                {event.title}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/each}
    </ThemedCard>
  {/if}

  {#if isEventModalOpen && selectedEvent}
    <EventModal
      event={selectedEvent}
      isOpen={isEventModalOpen}
      on:close={() => { isEventModalOpen = false; selectedEvent = null; }}
      on:save={handleEventSave}
    />
  {/if}

  {#if isQuickAddOpen}
    <QuickAddModal
      isOpen={isQuickAddOpen}
      defaultDate={quickAddDate}
      on:close={() => { isQuickAddOpen = false; quickAddDate = undefined; }}
      on:create={handleQuickAdd}
    />
  {/if}
</div>

<style>
  .week-view {
    max-width: 1400px;
    margin: 0 auto;
  }

  .week-header {
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

  .week-header h2 {
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

  .week-grid {
    display: grid;
    grid-template-columns: 80px repeat(7, 1fr);
    overflow: hidden;
  }

  .time-column {
    border-right: 1px solid var(--border-color);
  }

  .time-header {
    height: 60px;
    border-bottom: 1px solid var(--border-color);
  }

  .time-cell {
    height: 60px;
    padding: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .day-column {
    border-right: 1px solid var(--border-color);
  }

  .day-column:last-child {
    border-right: none;
  }

  .day-header {
    height: 60px;
    border-bottom: 1px solid var(--border-color);
    padding: 0.5rem;
    text-align: center;
    background: var(--bg-hover);
  }

  .day-header.today {
    background: var(--accent-light, rgba(59, 130, 246, 0.1));
  }

  .day-header.today .day-number {
    background: var(--accent-color);
    color: white;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    margin: 0 auto;
    font-weight: var(--font-weight-bold, 700);
  }

  .day-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .day-number {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .hour-cell {
    height: 60px;
    border-bottom: 1px solid var(--border-color);
    padding: 0.25rem;
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
  }

  .hour-cell:hover {
    background: var(--bg-hover);
  }

  .event-item {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius-sm, 0.375rem);
    color: white;
    margin-bottom: 0.25rem;
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

