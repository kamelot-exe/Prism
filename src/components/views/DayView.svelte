<script lang="ts">
  import { onMount } from 'svelte';
  import { getEvents, type Event } from '../../lib/api';

  let events: Event[] = [];
  let currentDate = new Date();
  let loading = false;
  let error: string | null = null;

  const hours = Array.from({ length: 24 }, (_, i) => i);

  onMount(async () => {
    await loadEvents();
  });

  async function loadEvents() {
    loading = true;
    error = null;
    try {
      const startDate = new Date(currentDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(currentDate);
      endDate.setHours(23, 59, 59, 999);
      events = await getEvents(startDate.toISOString(), endDate.toISOString());
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load events';
    } finally {
      loading = false;
    }
  }

  function getEventsForHour(hour: number): Event[] {
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.getDate() === currentDate.getDate() &&
             eventDate.getMonth() === currentDate.getMonth() &&
             eventDate.getFullYear() === currentDate.getFullYear() &&
             eventDate.getHours() === hour;
    });
  }

  function previousDay() {
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() - 1);
    loadEvents();
  }

  function nextDay() {
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
    loadEvents();
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
</script>

<div class="day-view">
  <div class="day-header">
    <button class="nav-button" on:click={previousDay}>←</button>
    <h2>{formatDate(currentDate)}</h2>
    <button class="nav-button" on:click={nextDay}>→</button>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <div class="day-timeline">
    {#each hours as hour}
      <div class="hour-row">
        <div class="time-label">{hour}:00</div>
        <div class="hour-content">
          {#each getEventsForHour(hour) as event}
            <div class="event-item" style="background-color: var(--accent-color, #3b82f6);">
              <div class="event-time">
                {formatTime(new Date(event.start_time))} - {formatTime(new Date(event.end_time))}
              </div>
              <div class="event-title">{event.title}</div>
              {#if event.description}
                <div class="event-description">{event.description}</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .day-view {
    max-width: 1000px;
    margin: 0 auto;
  }

  .day-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .day-header h2 {
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

  .day-timeline {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .hour-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    border-bottom: 1px solid var(--border-color);
    min-height: 80px;
  }

  .hour-row:last-child {
    border-bottom: none;
  }

  .time-label {
    padding: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    border-right: 1px solid var(--border-color);
    text-align: right;
  }

  .hour-content {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .event-item {
    padding: 0.75rem;
    border-radius: 0.375rem;
    color: white;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .event-item:hover {
    opacity: 0.9;
  }

  .event-time {
    font-size: 0.75rem;
    opacity: 0.9;
    margin-bottom: 0.25rem;
  }

  .event-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .event-description {
    font-size: 0.875rem;
    opacity: 0.9;
  }
</style>

