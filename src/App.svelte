<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TopBar from './components/TopBar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import MonthView from './components/views/MonthView.svelte';
  import WeekView from './components/views/WeekView.svelte';
  import DayView from './components/views/DayView.svelte';
  import QuickAddModal from './components/modals/QuickAddNew.svelte';
  import EventModal from './components/modals/EventModalNew.svelte';
  import ToastContainer from './components/common/ToastContainer.svelte';
  import SettingsPage from './components/settings/SettingsPage.svelte';
  import ProductivityInsights from './components/productivity/ProductivityInsights.svelte';
  import CommandPalette from './components/command/CommandPalette.svelte';
  import FocusOverlay from './components/productivity/FocusOverlay.svelte';
  import type { Event } from './lib/api';
  import { eventsStore } from './stores/eventsStore';
  import { settingsStore } from './stores/settings';
  import { uiStore, type View } from './stores/ui';
  import { focusStore } from './stores/focusStore';
  import { start as startReminders } from './lib/reminders/reminderScheduler';
  import { getEvents } from './lib/api';
  import { createShortcutHandler } from './lib/keyboard/shortcuts';
  import { reminderStore } from './stores/reminderStore';
  import { uiNavigationStore } from './stores/uiNavigationStore';
  import { tasksStore } from './stores/tasksStore';
  import { normalizeDate } from './lib/dates/safeDate';
  import { get } from 'svelte/store';
  import { plannedEventsStore } from './stores/plannedEventsStore';
  import { commandStore } from './stores/commandStore';
  import GlobalSearch from './components/search/GlobalSearch.svelte';
  import { searchStore } from './stores/searchStore';

  let currentDate = new Date();
  let viewMode: 'day' | 'week' | 'month' = 'month';
  let searchQuery = '';
  let quickAddOpen = false;
  let eventModalOpen = false;
  let selectedEvent: Event | null = null;
  let quickAddDate: Date | null = null;
  let currentView: View = 'calendar';
  let sidebarHovered = false;
  
  function handleGlobalKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    
    // Cmd/Ctrl + K opens command palette (works even in inputs)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      commandStore.open();
      return;
    }

    // Cmd/Ctrl + F opens global search
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchStore.open();
      return;
    }

    // Don't handle other shortcuts if user is typing in an input
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // N: Quick Add Event
    if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      quickAddOpen = true;
      return;
    }

    // T: Focus task input
    if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('focus-task-input'));
      return;
    }

    // F: Toggle focus mode
    if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      focusStore.toggleFocusMode();
      return;
    }

    const shortcuts = createShortcutHandler([
      {
        shortcut: { key: 'ArrowLeft', shift: true },
        handler: () => {
          // Week navigation
          if (viewMode === 'week' || viewMode === 'month') {
            navigate('prev');
          }
        },
      },
      {
        shortcut: { key: 'ArrowRight', shift: true },
        handler: () => {
          // Week navigation
          if (viewMode === 'week' || viewMode === 'month') {
            navigate('next');
          }
        },
      },
      {
        shortcut: { key: 'ArrowLeft' },
        handler: () => {
          // Day navigation
          if (viewMode === 'day') {
            navigate('prev');
          }
        },
      },
      {
        shortcut: { key: 'ArrowRight' },
        handler: () => {
          // Day navigation
          if (viewMode === 'day') {
            navigate('next');
          }
        },
      },
    ]);

    shortcuts(e);
  }

  function handleNotificationClick(event: CustomEvent) {
    const data = event.detail;
    if (!data || !data.source) return;

    if (data.source === 'task' && typeof data.id === 'number') {
      const tasks = get(tasksStore);
      const task = tasks.find((t) => t.id === data.id);
      if (task && task.date) {
        const taskDate = normalizeDate(new Date(task.date));
        currentDate = taskDate;
        uiNavigationStore.focusTask(data.id);
      }
    } else if (data.source === 'event' && typeof data.id === 'number') {
      const event = eventsStore.getById(data.id);
      if (event) {
        const eventDate = normalizeDate(new Date(event.start_time));
        currentDate = eventDate;
        uiNavigationStore.focusEvent(data.id);
      }
    } else if (data.source === 'block' && typeof data.id === 'string') {
      const blocks = get(plannedEventsStore);
      const block = blocks.find((b) => b.id === data.id);
      if (block) {
        const blockDate = normalizeDate(block.start);
        currentDate = blockDate;
        uiNavigationStore.focusBlock(data.id);
      }
    }
  }

  function handleSearchJumpEvent(event: CustomEvent) {
    const { eventId } = event.detail;
    const foundEvent = eventsStore.getById(eventId);
    if (foundEvent) {
      const eventDate = normalizeDate(new Date(foundEvent.start_time));
      currentDate = eventDate;
      selectedEvent = foundEvent;
      eventModalOpen = true;
    }
  }

  function handleSearchJumpTask(event: CustomEvent) {
    const { taskId, date } = event.detail;
    if (date) {
      currentDate = normalizeDate(date);
    }
    uiNavigationStore.focusTask(taskId);
  }

  function handleSearchJumpCategory(event: CustomEvent) {
    const { categoryId } = event.detail;
    window.dispatchEvent(new CustomEvent('search-category-selected', { detail: { categoryId } }));
  }

  onMount(async () => {
    settingsStore.init();
    startReminders(() => getEvents().then((evs) => evs.filter((e) => e.reminder_minutes != null)));
    reminderStore.init();
    window.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('notification-click', handleNotificationClick as EventListener);
    window.addEventListener('search-jump-event', handleSearchJumpEvent as EventListener);
    window.addEventListener('search-jump-task', handleSearchJumpTask as EventListener);
    window.addEventListener('search-jump-category', handleSearchJumpCategory as EventListener);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.removeEventListener('notification-click', handleNotificationClick as EventListener);
    window.removeEventListener('search-jump-event', handleSearchJumpEvent as EventListener);
    window.removeEventListener('search-jump-task', handleSearchJumpTask as EventListener);
    window.removeEventListener('search-jump-category', handleSearchJumpCategory as EventListener);
    reminderStore.cleanup();
  });

  uiStore.subscribe((state) => (currentView = state.currentView));

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

  async function handleQuickAddCreate(event: CustomEvent<{ title: string; start: string; end: string; categoryId: number | null; reminderMinutes: number | null; notes: string }>) {
    const payload = event.detail;
    try {
      await eventsStore.create({
        title: payload.title,
        description: payload.notes,
        start_time: payload.start,
        end_time: payload.end,
        category_id: payload.categoryId,
        reminder_minutes: payload.reminderMinutes,
      });
    } catch {
      // errors are handled in the store toasts
    } finally {
      quickAddOpen = false;
    }
  }

  async function handleEventSave(event: CustomEvent<Event>) {
    const payload = event.detail;
    try {
      if (payload.id) {
        await eventsStore.update({ ...payload, id: payload.id });
      } else {
        await eventsStore.create(payload);
      }
    } catch {
      // errors are handled in the store toasts
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
  />

  {#if currentView === 'settings'}
    <div class="settings-body">
      <SettingsPage />
    </div>
  {:else if currentView === 'insights'}
    <div class="settings-body">
      <div class="insights-header">
        <button class="back-btn" on:click={() => uiStore.setView('calendar')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          Back to Calendar
        </button>
      </div>
      <ProductivityInsights />
    </div>
  {:else}
    <div class="body">
      <div class="sidebar-trigger" on:mouseenter={() => (sidebarHovered = true)} on:mouseleave={() => (sidebarHovered = false)}>
        <button class="menu-button" aria-label="Open sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
      {#if sidebarHovered}
        <div 
          class="sidebar-backdrop" 
          on:mouseenter={() => (sidebarHovered = true)}
          on:mouseleave={() => (sidebarHovered = false)}
        ></div>
      {/if}
      <Sidebar 
        {currentDate} 
        isHovered={sidebarHovered} 
        on:dateSelect={(e) => (currentDate = e.detail)}
        on:hoverChange={(e) => (sidebarHovered = e.detail)}
      />
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
            on:navigate={(e) => navigate(e.detail)}
          />
        {/if}
      </main>
    </div>
  {/if}

  <QuickAddModal
    isOpen={quickAddOpen}
    defaultDate={quickAddDate}
    on:close={() => (quickAddOpen = false)}
    on:create={handleQuickAddCreate}
  />
  <EventModal
    isOpen={eventModalOpen}
    event={selectedEvent}
    on:close={() => { eventModalOpen = false; selectedEvent = null; }}
    on:save={handleEventSave}
  />
  <ToastContainer />
  <FocusOverlay />
  <CommandPalette {currentDate} />
  <GlobalSearch />
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(
      --bg-gradient,
      radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), transparent 35%),
      linear-gradient(145deg, var(--bg, #0b1021), var(--bg-alt, #0b1021))
    );
    color: var(--text);
  }
  .body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 12px 16px 16px 16px;
    align-items: start;
    position: relative;
  }

  .sidebar-trigger {
    position: fixed;
    left: 0;
    top: calc(var(--topbar-height) + 12px);
    z-index: 51;
    padding: 8px;
  }

  .menu-button {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-0);
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-sm);
    transition: all 150ms ease;
  }

  .menu-button:hover {
    background: var(--surface-1);
    box-shadow: var(--shadow-md);
    transform: translateX(2px);
  }

  .menu-button svg {
    width: 20px;
    height: 20px;
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    top: var(--topbar-height);
    background: var(--modal-backdrop, rgba(0, 0, 0, 0.4));
    backdrop-filter: blur(2px);
    z-index: 49;
    pointer-events: auto;
  }

  .settings-body {
    padding: 16px;
  }

  .insights-header {
    margin-bottom: 12px;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 150ms ease;
  }

  .back-btn:hover {
    background: var(--surface-0);
    color: var(--text);
    transform: translateX(-2px);
  }

  .back-btn svg {
    width: 16px;
    height: 16px;
  }
  main {
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: var(--shadow-sm);
    height: calc(100vh - var(--topbar-height) - 16px);
    overflow-y: auto;
  }
</style>


