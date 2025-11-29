<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let currentDate: Date;
  export let viewMode: 'day' | 'week' | 'month' = 'month';

  const dispatch = createEventDispatcher<{
    navigate: { direction: 'prev' | 'next' | 'today' };
    viewChange: 'day' | 'week' | 'month';
    openQuickAdd: void;
    openSettings: void;
    search: string;
  }>();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let searchQuery = '';

  $: monthYear = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  function handleKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      dispatch('openQuickAdd');
    }
  }

  function handleSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    searchQuery = value;
    dispatch('search', value);
  }

  onMount(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

<header class="topbar">
  <div class="left">
    <div class="title-block">
      <button class="icon-button" on:click={() => dispatch('navigate', { direction: 'prev' })} aria-label="Previous">
        ←
      </button>
      <button class="pill" on:click={() => dispatch('navigate', { direction: 'today' })}>Today</button>
      <button class="icon-button" on:click={() => dispatch('navigate', { direction: 'next' })} aria-label="Next">
        →
      </button>
      <div class="date-label">
        <p>Prism Calendar</p>
        <h1>{monthYear}</h1>
      </div>
    </div>
  </div>

  <div class="center">
    <div class="segmented">
      <button class:active={viewMode === 'day'} on:click={() => dispatch('viewChange', 'day')}>Day</button>
      <button class:active={viewMode === 'week'} on:click={() => dispatch('viewChange', 'week')}>Week</button>
      <button class:active={viewMode === 'month'} on:click={() => dispatch('viewChange', 'month')}>Month</button>
    </div>
  </div>

  <div class="right">
    <div class="search">
      <input
        type="search"
        placeholder="Search events, categories, todos"
        bind:value={searchQuery}
        on:input={handleSearchInput}
      />
    </div>
    <button class="primary" on:click={() => dispatch('openQuickAdd')}>Quick Add (Ctrl/Cmd+K)</button>
    <button class="ghost" on:click={() => dispatch('openSettings')}>Settings</button>
  </div>
</header>

<style>
  .topbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--topbar-bg);
    border-bottom: 1px solid var(--topbar-border);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .left, .center, .right { display: flex; align-items: center; gap: 1rem; }

  .title-block { display: flex; align-items: center; gap: 0.5rem; }
  .date-label p { margin: 0; color: var(--text-muted); font-size: 0.85rem; }
  .date-label h1 { margin: 0; font-size: 1.25rem; color: var(--text); }

  .icon-button {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--button-bg);
    color: var(--button-text);
    cursor: pointer;
    transition: 0.2s ease;
  }
  .icon-button:hover { background: var(--button-hover); }

  .pill {
    border: none;
    background: var(--accent-light);
    color: var(--text);
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    cursor: pointer;
    border: 1px solid var(--border);
  }

  .segmented {
    display: inline-flex;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .segmented button {
    border: none;
    background: transparent;
    padding: 0.65rem 1rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: 0.2s ease;
  }
  .segmented button:hover { background: var(--bg-hover); color: var(--text); }
  .segmented button.active {
    background: var(--accent-light);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .search { flex: 1; }
  .search input {
    width: 100%;
    padding: 0.65rem 0.9rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text);
  }

  .primary, .ghost {
    border-radius: var(--radius-md);
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: 0.2s ease;
  }
  .primary {
    background: var(--button-bg);
    color: var(--button-text);
  }
  .primary:hover { background: var(--button-hover); }
  .ghost { background: transparent; color: var(--text); }
  .ghost:hover { background: var(--bg-hover); }
</style>
