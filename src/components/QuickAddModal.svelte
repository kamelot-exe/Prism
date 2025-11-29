<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { listCategories, type Category } from '../lib/api';
  import ThemedCard from './ThemedCard.svelte';
  import { loadTheme, type Theme } from '../lib/theme';
  import { settingsStore } from '../stores/settings';

  export let isOpen = false;
  export let defaultDate: Date | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: void; create: { title: string; date: Date; categoryId: number | null } }>();

  let title = '';
  let selectedCategoryId: number | null = null;
  let categories: Category[] = [];
  let loading = false;
  let theme: Theme | null = null;

  $: if (isOpen) {
    loadData();
  }

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

  async function loadData() {
    loading = true;
    try {
      categories = await listCategories();
      title = '';
      selectedCategoryId = null;
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    isOpen = false;
    title = '';
    selectedCategoryId = null;
    dispatch('close');
  }

  function handleCreate() {
    if (!title.trim()) return;

    const date = defaultDate || new Date();
    dispatch('create', {
      title: title.trim(),
      date,
      categoryId: selectedCategoryId,
    });

    handleClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      handleCreate();
    } else if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="quick-add-title"
  >
    {#if theme}
      <ThemedCard theme={theme} elevation="lg" padding="md" variant="glass" class="modal-content">
        <div class="modal-header">
          <h2 id="quick-add-title">Quick Add Event</h2>
          <button class="close-button" on:click={handleClose} type="button" aria-label="Close">×</button>
        </div>

        {#if loading}
          <div class="loading">Loading...</div>
        {:else}
          <div class="modal-body">
            <div class="form-group">
              <input
                type="text"
                bind:value={title}
                placeholder="What's happening?"
                class="quick-input"
                autofocus
              />
            </div>

            <div class="category-pills">
              <button
                class="category-pill"
                class:active={selectedCategoryId === null}
                on:click={() => selectedCategoryId = null}
                type="button"
              >
                None
              </button>
              {#each categories as category}
                <button
                  class="category-pill"
                  class:active={selectedCategoryId === category.id}
                  style:background={selectedCategoryId === category.id ? category.color : 'transparent'}
                  style:border-color={category.color}
                  style:color={selectedCategoryId === category.id ? 'white' : category.color}
                  on:click={() => selectedCategoryId = category.id}
                  type="button"
                >
                  {category.name}
                </button>
              {/each}
            </div>
          </div>

          <div class="modal-footer">
            <button class="button button-secondary" on:click={handleClose} type="button">
              Cancel
            </button>
            <button
              class="button button-primary"
              on:click={handleCreate}
              disabled={!title.trim()}
              type="button"
            >
              Create
            </button>
          </div>
        {/if}
      </ThemedCard>
    {/if}
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
    animation: fadeIn 0.15s;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    max-width: 500px;
    width: 100%;
    animation: slideUp 0.2s var(--animation-easing, ease);
  }

  @keyframes slideUp {
    from {
      transform: translateY(10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm, 0.375rem);
    transition: all 0.2s;
  }

  .close-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .quick-input {
    width: 100%;
    padding: 1rem;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-md, 0.5rem);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1.125rem;
    font-family: var(--font-family);
    transition: all 0.2s;
  }

  .quick-input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px var(--accent-light, rgba(59, 130, 246, 0.1));
  }

  .category-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .category-pill {
    padding: 0.5rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-lg, 0.75rem);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: var(--font-weight-medium, 500);
    cursor: pointer;
    transition: all 0.2s;
  }

  .category-pill:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .category-pill.active {
    font-weight: var(--font-weight-semibold, 600);
    box-shadow: var(--shadow-md);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius-md, 0.5rem);
    font-size: 1rem;
    font-weight: var(--font-weight-medium, 500);
    cursor: pointer;
    transition: all var(--animation-duration, 0.3s) var(--animation-easing, ease);
  }

  .button-primary {
    background: var(--accent-color);
    color: white;
  }

  .button-primary:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .button-secondary {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .button-secondary:hover {
    background: var(--bg-secondary);
  }

  .button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }
</style>

