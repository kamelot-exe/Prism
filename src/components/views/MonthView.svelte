<script lang="ts">
  import { onMount } from 'svelte';
  import { getEvents, type Event } from '../../lib/api';
  import { settingsStore } from '../../stores/settings';
  import EventModal from '../EventModal.svelte';
  import QuickAddModal from '../QuickAddModal.svelte';

  export let currentDate: Date;
  export let searchQuery: string = '';

  let events: Event[] = [];
  let loading = false;
  let error: string | null = null;
  let selectedEvent: Event | null = null;
  let isEventModalOpen = false;
  let isQuickAddOpen = false;
  let quickAddDate: Date | undefined;

  $: year = currentDate.getFullYear();
  $: month = currentDate.getMonth();

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
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.getDate() === day && 
             eventDate.getMonth() === month && 
             eventDate.getFullYear() === year;
    });
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
    return 'var(--accent)';
  }

  $: filteredEvents = searchQuery 
    ? events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : events;

  function isToday(day: number): boolean {
    const today = new Date();
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear();
  }
</script>

<div class="month-view">
  {#if error}
    <div class="error">{error}</div>
  {/if}

  <div class="calendar-grid">
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
  </div>
</div>

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

<style>
  .month-view {
    width: 100%;
    height: 100%;
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
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-md);
    box-shadow: var(--card-shadow);
    overflow: hidden;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--grid-line);
  }

  .weekday {
    padding: var(--spacing-md);
    text-align: center;
    font-weight: var(--font-weight-semibold);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  .calendar-day {
    min-height: 120px;
    border-right: 1px solid var(--grid-line);
    border-bottom: 1px solid var(--grid-line);
    padding: var(--spacing-sm);
    position: relative;
    cursor: pointer;
    transition: background var(--animation-duration) var(--animation-easing);
  }

  .calendar-day:hover:not(.empty) {
    background: var(--bg-hover);
  }

  .calendar-day.empty {
    background: var(--bg-secondary);
    cursor: default;
  }

  .calendar-day.today .day-number {
    background: var(--accent);
    color: white;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: var(--font-weight-bold);
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
    font-size: var(--font-size-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--spacing-xs);
  }

  .event-item:hover {
    opacity: 0.9;
    transform: translateX(2px);
    box-shadow: var(--shadow-xs);
  }

  .event-item:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>

