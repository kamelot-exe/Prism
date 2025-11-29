<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { settingsStore } from '../stores/settings';

  export let currentDate: Date;
  export let viewMode: 'day' | 'week' | 'month' = 'month';

  const dispatch = createEventDispatcher<{
    navigate: { direction: 'prev' | 'next' | 'today' };
    viewChange: 'day' | 'week' | 'month';
    search: string;
  }>();

  let searchQuery = '';
  let showSearch = false;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  $: monthYear = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  function handlePrev() {
    dispatch('navigate', { direction: 'prev' });
  }

  function handleNext() {
    dispatch('navigate', { direction: 'next' });
  }

  function handleToday() {
    dispatch('navigate', { direction: 'today' });
  }

  function handleViewChange(mode: 'day' | 'week' | 'month') {
    dispatch('viewChange', mode);
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
    dispatch('search', searchQuery);
  }

  function toggleSearch() {
    showSearch = !showSearch;
    if (!showSearch) {
      searchQuery = '';
      dispatch('search', '');
    }
  }
</script>

<div class="topbar">
  <div class="topbar-left">
    <div class="date-navigation">
      <button class="nav-button" on:click={handlePrev} aria-label="Previous">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12 15L7 10L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      
      <button class="today-button" on:click={handleToday}>
        Today
      </button>
      
      <button class="nav-button" on:click={handleNext} aria-label="Next">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M8 5L13 10L8 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      
      <h1 class="month-year">{monthYear}</h1>
    </div>
  </div>

  <div class="topbar-center">
    <div class="view-switcher">
      <button
        class="view-button"
        class:active={viewMode === 'day'}
        on:click={() => handleViewChange('day')}
      >
        Day
      </button>
      <button
        class="view-button"
        class:active={viewMode === 'week'}
        on:click={() => handleViewChange('week')}
      >
        Week
      </button>
      <button
        class="view-button"
        class:active={viewMode === 'month'}
        on:click={() => handleViewChange('month')}
      >
        Month
      </button>
    </div>
  </div>

  <div class="topbar-right">
    <div class="search-container">
      {#if showSearch}
        <input
          type="text"
          class="search-input"
          placeholder="Search events..."
          value={searchQuery}
          on:input={handleSearchInput}
          autofocus
        />
        <button class="search-close" on:click={toggleSearch} aria-label="Close search">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      {:else}
        <button class="search-button" on:click={toggleSearch} aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2"/>
            <path d="M14 14L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .topbar {
    height: var(--topbar-height, 64px);
    background: var(--topbar-bg);
    border-bottom: 1px solid var(--topbar-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--spacing-xl);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
  }

  .topbar-left,
  .topbar-center,
  .topbar-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .date-navigation {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .nav-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--button-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .nav-button:hover {
    background: var(--button-hover);
    transform: translateY(-1px);
  }

  .nav-button:active {
    background: var(--button-active);
    transform: translateY(0);
  }

  .today-button {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .today-button:hover {
    background: var(--accent-secondary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .month-year {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text);
    margin-left: var(--spacing-lg);
  }

  .view-switcher {
    display: flex;
    gap: var(--spacing-xs);
    background: var(--bg-secondary);
    padding: var(--spacing-xs);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .view-button {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .view-button:hover {
    color: var(--text);
    background: var(--bg-hover);
  }

  .view-button.active {
    background: var(--accent);
    color: white;
    box-shadow: var(--shadow-xs);
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .search-button,
  .search-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--button-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .search-button:hover,
  .search-close:hover {
    background: var(--button-hover);
  }

  .search-input {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: var(--font-size-sm);
    width: 300px;
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-light);
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }
</style>

