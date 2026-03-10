<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { uiStore } from '../stores/ui';
  import { normalizeDate } from '../lib/dates/safeDate';
  import { reminderStore } from '../stores/reminderStore';
  import { focusStore } from '../stores/focusStore';
  import type { FocusSession } from '../stores/focusStore';
  import { searchStore } from '../stores/searchStore';

  export let currentDate: Date | undefined = new Date();
  export let viewMode: 'day' | 'week' | 'month' = 'month';

  const dispatch = createEventDispatcher<{
    navigate: { direction: 'prev' | 'next' | 'today' };
    viewChange: 'day' | 'week' | 'month';
    openQuickAdd: void;
    search: string;
  }>();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let searchQuery = '';
  let upcomingReminders: Array<{ at: Date; priority: number; source: 'task' | 'event' | 'block'; id: number | string }> = [];

  let safeDate = new Date();
  $: safeDate = normalizeDate(currentDate);

  $: monthYear = `${monthNames[safeDate.getMonth()]} ${safeDate.getFullYear()}`;

  let unsubscribeReminders: (() => void) | null = null;
  let unsubscribeFocusMode: (() => void) | null = null;
  let unsubscribeFocusSession: (() => void) | null = null;

  onMount(() => {
    unsubscribeReminders = reminderStore.upcomingReminders.subscribe((reminders) => {
      upcomingReminders = reminders;
    });
    unsubscribeFocusMode = focusStore.focusModeEnabled.subscribe((enabled) => {
      focusModeEnabled = enabled;
    });
    unsubscribeFocusSession = focusStore.session.subscribe((s) => {
      session = s;
    });
  });

  onDestroy(() => {
    unsubscribeReminders?.();
    unsubscribeFocusMode?.();
    unsubscribeFocusSession?.();
  });

  $: hasUpcomingReminder = upcomingReminders.some((r) => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    return r.at.getTime() - now <= oneHour;
  });

  let focusModeEnabled = false;
  let session: FocusSession = {
    state: 'idle',
    startedAt: null,
    endsAt: null,
    remainingMs: 0,
    source: null,
    sourceId: null,
    title: '',
  };

  $: hasActiveSession = session.state === 'running' || session.state === 'paused';

  function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function handleFocusToggle() {
    focusStore.toggleFocusMode();
  }

  function handleTimerChipClick() {
    if (hasActiveSession) {
      const overlay = document.querySelector('.focus-overlay');
      if (overlay) {
        overlay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      focusStore.toggleFocusMode();
    }
  }

  function handleSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    searchQuery = value;
    dispatch('search', value);
  }

  function handleSearchFocus(e: FocusEvent) {
    e.preventDefault();
    searchStore.open();
    if (searchQuery) {
      searchStore.updateQuery(searchQuery);
    }
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      searchStore.open();
      if (searchQuery) {
        searchStore.updateQuery(searchQuery);
      }
    }
  }

</script>

<header class="topbar">
  <div class="brand">
    <div class="logo">PR</div>
    <div class="titles">
      <span>Prism Calendar</span>
      <small>Calendar, tasks, and planning</small>
    </div>
  </div>

  <div class="controls">
    <div class="nav">
      <button class="icon" aria-label="Previous" on:click={() => dispatch('navigate', { direction: 'prev' })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <button class="ghost" on:click={() => dispatch('navigate', { direction: 'today' })}>Today</button>
      <button class="icon" aria-label="Next" on:click={() => dispatch('navigate', { direction: 'next' })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>
    <div class="date">
      <p>{monthYear}</p>
      <span>{safeDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}</span>
    </div>
    <div class="views">
      <button class:active={viewMode === 'month'} on:click={() => dispatch('viewChange', 'month')}>Month</button>
      <button class:active={viewMode === 'week'} on:click={() => dispatch('viewChange', 'week')}>Week</button>
      <button class:active={viewMode === 'day'} on:click={() => dispatch('viewChange', 'day')}>Day</button>
    </div>
  </div>

  <div class="actions">
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/></svg>
      <input
        type="search"
        placeholder="Find existing items (Cmd/Ctrl+F)"
        bind:value={searchQuery}
        on:input={handleSearchInput}
        on:focus={handleSearchFocus}
        on:keydown={handleSearchKeydown}
      />
    </div>
    <button class="primary" title="Create a new event quickly" on:click={() => dispatch('openQuickAdd')}>
      New Event
      <span class="key-hint">N</span>
    </button>
    {#if hasActiveSession}
      <button class="ghost timer-chip" on:click={handleTimerChipClick} title="Focus session">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>{formatTime(session.remainingMs)}</span>
      </button>
    {:else}
      <button class="ghost" on:click={handleFocusToggle} title="Toggle Focus Mode" class:active={focusModeEnabled}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        Focus
      </button>
    {/if}
    <button class="ghost bell-icon" title="Reminders">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {#if hasUpcomingReminder}
        <span class="bell-badge"></span>
      {/if}
    </button>
    <button class="ghost" title="Open productivity insights" on:click={() => uiStore.setView('insights')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Insights
    </button>
    <button class="ghost" on:click={() => uiStore.setView('settings')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c0 .69.4 1.31 1.02 1.58.29.13.61.2.93.2H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      Settings
    </button>
  </div>
</header>

<style>
  .topbar {
    display: grid;
    grid-template-columns: 260px 1fr 520px;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    background: var(--surface-0);
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent-secondary)));
    display: grid;
    place-items: center;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--bg);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 26px rgba(0,0,0,0.18);
  }
  .titles { display: grid; line-height: 1.1; color: var(--text); }
  .titles span { font-weight: 700; letter-spacing: 0.01em; }
  .titles small { color: var(--text-muted); font-size: 0.9rem; }

  .controls {
    display: grid;
    grid-template-columns: 240px 1fr 220px;
    gap: 12px;
    align-items: center;
  }

  .nav { display: inline-flex; gap: 0.35rem; align-items: center; }
  .icon {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background 160ms ease, transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }
  .icon:hover { background: var(--surface-0); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
  .icon:active { transform: translateY(0); opacity: 0.92; }
  .icon svg { width: 18px; height: 18px; }

  .ghost {
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
    min-height: 40px;
  }
  .ghost:hover { background: var(--surface-0); border-color: var(--border-light); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
  .ghost:active { transform: translateY(0); opacity: 0.92; }

  .date {
    display: grid;
    gap: 0.15rem;
    align-items: center;
  }
  .date p { margin: 0; font-weight: 700; color: var(--text); }
  .date span { color: var(--text-muted); font-size: 0.95rem; }

  .views {
    display: inline-flex;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: inset 0 1px 0 var(--border-light);
  }
  .views button {
    border: none;
    background: transparent;
    padding: 10px 14px;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
  }
  .views button:hover { background: var(--surface-0); color: var(--text); }
  .views button.active {
    background: var(--accent-light, var(--surface-0));
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--border-light);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr auto auto auto auto;
    gap: 0.6rem;
    align-items: center;
  }
  .search {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
  }
  .search input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    width: 100%;
  }
  .search input::placeholder { color: var(--text-muted); }
  .search svg { width: 18px; height: 18px; color: var(--text-muted); }

  .primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, var(--accent-2, var(--accent)), var(--accent));
    color: var(--text);
    border: 1px solid var(--accent);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    cursor: pointer;
    font-weight: 700;
    box-shadow: var(--shadow-sm);
    transition: transform 150ms ease, box-shadow 150ms ease, filter 150ms ease;
  }
  .primary:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); filter: brightness(1.05); }
  .primary:active { transform: translateY(0); filter: brightness(0.98); }
  .key-hint {
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: var(--surface-0);
    border: 1px solid var(--border);
    font-size: 0.8rem;
    color: var(--text);
  }

  .actions .ghost {
    border-radius: var(--radius-md);
    padding: 10px 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .actions .ghost svg { width: 18px; height: 18px; }

  .bell-icon {
    position: relative;
  }

  .bell-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--surface-0);
  }

  .timer-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }

  .timer-chip svg {
    width: 16px;
    height: 16px;
  }

  .ghost.active {
    background: var(--accent-light, var(--surface-1));
    border-color: var(--accent);
    color: var(--accent);
  }
</style>


