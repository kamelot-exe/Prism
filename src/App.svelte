<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from './components/TopBar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import MonthView from './components/views/MonthView.svelte';
  import WeekView from './components/views/WeekView.svelte';
  import DayView from './components/views/DayView.svelte';
  import QuickAddModal from './components/QuickAddModal.svelte';
  import EventModal from './components/EventModal.svelte';
  import Settings from './components/Settings.svelte';
  import { createEvent, updateEvent, type Event } from './lib/api';
  import { settingsStore } from './stores/settings';

  let currentDate = new Date();
  let viewMode: 'day' | 'week' | 'month' = 'month';
  let searchQuery = '';
  let quickAddOpen = false;
  let settingsOpen = false;
  let eventModalOpen = false;
  let selectedEvent: Event | null = null;
  let quickAddDate: Date | null = null;

  onMount(async () => {
    await settingsStore.applyTheme($settingsStore.theme);
  });

  function navigate(direction: 'prev' | 'next' | 'today') {
    if (direction === 'today') {
      currentDate = new Date();
      return;
    }
    const delta = direction === 'next' ? 1 : -1;
    if (viewMode === 'month') {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    } else if (viewMode === 'week') {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + delta * 7);
    } else {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + delta);
    }
  }

  function handleQuickAddCreate(event: CustomEvent<{ title: string; date: Date; categoryId: number | null }>) {
    const payload = event.detail;
    createEvent({
      title: payload.title,
      start_time: payload.date.toISOString(),
      end_time: new Date(payload.date.getTime() + 60 * 60 * 1000).toISOString(),
      category_id: payload.categoryId,
    }).finally(() => {
      quickAddOpen = false;
    });
  }

  function handleEventSave(event: CustomEvent<Event>) {
    const payload = event.detail;
    if (payload.id) {
      updateEvent({ ...payload, id: payload.id });
    } else {
      createEvent(payload);
    }
    eventModalOpen = false;
    selectedEvent = null;
  }
</script>

<div class="app">
  <TopBar
    {currentDate}
    {viewMode}
    on:navigate={(e) => navigate(e.detail.direction)}
    on:viewChange={(e) => (viewMode = e.detail)}
    on:search={(e) => (searchQuery = e.detail)}
    on:openQuickAdd={() => (quickAddOpen = true)}
    on:openSettings={() => (settingsOpen = true)}
  />

  <div class="body">
    <Sidebar {currentDate} on:dateSelect={(e) => (currentDate = e.detail)} />
    <main>
      {#if viewMode === 'month'}
        <MonthView
          {currentDate}
          {searchQuery}
          on:slot={(e) => { quickAddDate = e.detail; quickAddOpen = true; }}
          on:selectEvent={(e) => { selectedEvent = e.detail; eventModalOpen = true; }}
        />
      {:else if viewMode === 'week'}
        <WeekView
          {currentDate}
          {searchQuery}
          on:slot={(e) => { quickAddDate = e.detail; quickAddOpen = true; }}
          on:selectEvent={(e) => { selectedEvent = e.detail; eventModalOpen = true; }}
        />
      {:else}
        <DayView
          {currentDate}
          {searchQuery}
          on:slot={(e) => { quickAddDate = e.detail; quickAddOpen = true; }}
          on:selectEvent={(e) => { selectedEvent = e.detail; eventModalOpen = true; }}
        />
      {/if}
    </main>
  </div>

  <QuickAddModal
    isOpen={quickAddOpen}
    defaultDate={quickAddDate}
    on:close={() => (quickAddOpen = false)}
    on:create={handleQuickAddCreate}
  />
  <EventModal
    isOpen={eventModalOpen}
    event={selectedEvent}
    on:close={() => (eventModalOpen = false)}
    on:save={handleEventSave}
  />
  <Settings bind:isOpen={settingsOpen} />
</div>

<style>
  .app { height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--text); }
  .body { flex: 1; display: grid; grid-template-columns: 320px 1fr; overflow: hidden; }
  main { padding: 1rem; overflow-y: auto; background: var(--bg); }
</style>
