<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { searchStore } from '../../stores/searchStore';
  import type { SearchResult } from '../../lib/search/searchIndex';
  import type { SearchFilters } from '../../stores/searchStore';
  import { categoryStore } from '../../stores/categoryStore';
  import type { Category } from '../../lib/api';
  import { modalBehavior } from '../../lib/modalBehavior';

  let isOpen = false;
  let query = '';
  let filters: SearchFilters = {
    entity: 'all',
    categoryId: 'all',
    priority: 'all',
    focusOnly: false,
  };
  let results: SearchResult[] = [];
  let selectedIndex = 0;
  let inputElement: HTMLInputElement | null = null;
  let categories: Category[] = [];

  let unsubscribeOpen: (() => void) | null = null;
  let unsubscribeQuery: (() => void) | null = null;
  let unsubscribeFilters: (() => void) | null = null;
  let unsubscribeResults: (() => void) | null = null;
  let unsubscribeCategories: (() => void) | null = null;

  onMount(() => {
    unsubscribeOpen = searchStore.subscribe((open) => {
      isOpen = open;
      if (!open) {
        selectedIndex = 0;
      }
    });
    unsubscribeQuery = searchStore.query.subscribe((q) => {
      query = q;
    });
    unsubscribeFilters = searchStore.filters.subscribe((f) => {
      filters = f;
    });
    unsubscribeResults = searchStore.results.subscribe((r) => {
      results = r;
      selectedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
    });
    unsubscribeCategories = categoryStore.subscribe((cats) => {
      categories = cats;
    });
  });

  onDestroy(() => {
    unsubscribeOpen?.();
    unsubscribeQuery?.();
    unsubscribeFilters?.();
    unsubscribeResults?.();
    unsubscribeCategories?.();
  });

  function close() {
    searchStore.close();
  }

  function handleQueryInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    searchStore.updateQuery(value);
  }

  function handleEntityChange(entity: 'all' | 'event' | 'task' | 'category') {
    searchStore.updateFilter('entity', entity);
  }

  function handleCategoryChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    const categoryId = value === 'all' ? 'all' : Number(value);
    searchStore.updateFilter('categoryId', categoryId);
  }

  function handlePriorityChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    searchStore.updateFilter('priority', value as 'all' | 'low' | 'normal' | 'high' | 'urgent');
  }

  function handleFocusOnlyChange(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    searchStore.updateFilter('focusOnly', checked);
  }

  function handleDateRangeChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    searchStore.updateFilter('dateRange', value as 'today' | 'week' | 'month' | 'custom' | undefined);
  }

  function handleResultClick(result: SearchResult) {
    searchStore.jumpTo(result);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % results.length;
      return;
    }

    if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      selectedIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
      return;
    }

    if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      searchStore.jumpTo(results[selectedIndex]);
      return;
    }
  }

  function highlightText(text: string, query: string): string {
    if (!query.trim()) return text;
    const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
    let highlighted = text;
    const lowerText = text.toLowerCase();

    for (const token of tokens) {
      const index = lowerText.indexOf(token);
      if (index >= 0) {
        const before = highlighted.substring(0, index);
        const match = highlighted.substring(index, index + token.length);
        const after = highlighted.substring(index + token.length);
        highlighted = `${before}<mark>${match}</mark>${after}`;
      }
    }

    return highlighted;
  }

  function formatDate(date: Date | undefined): string {
    if (!date) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate.getTime() === today.getTime()) {
      return 'Today';
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (targetDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  }
</script>

{#if isOpen}
  <div
    class="backdrop"
    role="presentation"
    tabindex="-1"
    use:modalBehavior={{ enabled: isOpen, onClose: close, initialFocus: () => inputElement }}
  >
    <button class="scrim" aria-label="Close search" on:click={close}></button>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="global-search-title" on:keydown={handleKeydown}>
      <div class="header">
        <div class="surface-copy">
          <p class="surface-label">Search</p>
          <p class="surface-hint">Search finds existing items. It does not create new ones.</p>
        </div>
        <div class="search-container">
          <label class="sr-only" id="global-search-title" for="global-search-input">Global search</label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/></svg>
          <input
            bind:this={inputElement}
            id="global-search-input"
            type="text"
            placeholder="Find events, tasks, and categories"
            value={query}
            on:input={handleQueryInput}
            class="search-input"
          />
        </div>
      </div>

      <div class="filters">
        <div class="filter-group">
          <div class="filter-tabs">
            <button
              class="filter-tab"
              class:active={filters.entity === 'all'}
              on:click={() => handleEntityChange('all')}
            >
              All
            </button>
            <button
              class="filter-tab"
              class:active={filters.entity === 'event'}
              on:click={() => handleEntityChange('event')}
            >
              Events
            </button>
            <button
              class="filter-tab"
              class:active={filters.entity === 'task'}
              on:click={() => handleEntityChange('task')}
            >
              Tasks
            </button>
            <button
              class="filter-tab"
              class:active={filters.entity === 'category'}
              on:click={() => handleEntityChange('category')}
            >
              Categories
            </button>
          </div>
        </div>

        <div class="filter-group">
          {#if filters.entity === 'all' || filters.entity === 'event'}
            <select class="filter-select" value={filters.categoryId || 'all'} on:change={handleCategoryChange}>
              <option value="all">All categories</option>
              {#each categories as category}
                {#if category.id}
                  <option value={category.id}>{category.name}</option>
                {/if}
              {/each}
            </select>
          {/if}

          {#if filters.entity === 'all' || filters.entity === 'task'}
            <select class="filter-select" value={filters.priority || 'all'} on:change={handlePriorityChange}>
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <label class="filter-checkbox">
              <input type="checkbox" checked={filters.focusOnly || false} on:change={handleFocusOnlyChange} />
              <span>Focus only</span>
            </label>
          {/if}

          <select class="filter-select" value={filters.dateRange || 'all'} on:change={handleDateRangeChange}>
            <option value="">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
      </div>

      <div class="results-container">
        {#if query.trim() && results.length > 0}
          <div class="results-list">
            {#each results as result, index (result.entity + '-' + result.id)}
              <button
                class="result-item"
                class:selected={index === selectedIndex}
                on:click={() => handleResultClick(result)}
                on:mouseenter={() => (selectedIndex = index)}
              >
                <div class="result-icon">
                  {#if result.entity === 'event'}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {:else if result.entity === 'task'}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  {:else}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  {/if}
                </div>
                <div class="result-content">
                  <div class="result-title">{@html highlightText(result.title, query)}</div>
                  {#if result.subtitle}
                    <div class="result-subtitle">{result.subtitle}</div>
                  {/if}
                  {#if result.date}
                    <div class="result-date">{formatDate(result.date)}</div>
                  {/if}
                </div>
                <div class="result-badge">{result.entity}</div>
              </button>
            {/each}
          </div>
        {:else if query.trim() && results.length === 0}
          <div class="empty-state">
            <p>No matching items found</p>
            <p class="hint">Try a broader search or change the filters.</p>
          </div>
        {:else}
          <div class="empty-state">
            <p>Start typing to find existing items</p>
            <p class="hint">Examples: "Meeting", "Review PR", "Work"</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop, rgba(0, 0, 0, 0.75));
    display: grid;
    place-items: center;
    padding: 1.5rem;
    z-index: 100;
    animation: fadeIn 150ms ease;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop {
      animation: none;
    }
    .modal {
      animation: none;
    }
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
  }

  .modal {
    width: min(700px, 100%);
    max-height: 80vh;
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 150ms ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .surface-copy {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
  }

  .surface-label {
    margin: 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .surface-hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .header {
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
  }

  .search-container svg {
    width: 20px;
    height: 20px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 1rem;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .filters {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--surface-1);
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-tabs {
    display: flex;
    gap: 4px;
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .filter-tab {
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background 150ms ease-out, color 150ms ease-out;
  }

  .filter-tab:hover {
    background: var(--surface-1);
    color: var(--text);
  }

  .filter-tab.active {
    background: var(--accent);
    color: var(--accent-text, white);
  }

  .filter-select {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-0);
    color: var(--text);
    font-size: 0.9rem;
    cursor: pointer;
  }

  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    color: var(--text);
    cursor: pointer;
  }

  .filter-checkbox input {
    cursor: pointer;
  }

  .results-container {
    flex: 1;
    overflow-y: auto;
    min-height: 200px;
    max-height: 400px;
  }

  .results-list {
    padding: 8px;
  }

  .result-item {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border: none;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: background 150ms ease-out;
  }

  .result-item:hover,
  .result-item.selected {
    background: var(--surface-1);
  }

  .result-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .result-icon svg {
    width: 100%;
    height: 100%;
  }

  .result-content {
    flex: 1;
    min-width: 0;
  }

  .result-title {
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
    word-break: break-word;
  }

  .result-title mark {
    background: var(--accent-light, rgba(59, 130, 246, 0.2));
    color: var(--accent);
    padding: 0 2px;
    border-radius: 2px;
  }

  .result-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 2px;
  }

  .result-date {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .result-badge {
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
    background: var(--surface-2);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .empty-state {
    padding: 48px 24px;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 0 0 8px 0;
  }

  .empty-state .hint {
    font-size: 0.9rem;
    opacity: 0.7;
  }
</style>


