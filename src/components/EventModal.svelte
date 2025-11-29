<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { listCategories, type Category, type Event } from '../lib/api';
  import ThemedCard from './ThemedCard.svelte';
  import { loadTheme, type Theme } from '../lib/theme';
  import { settingsStore } from '../stores/settings';

  export let event: Event | null = null;
  export let isOpen = false;

  const dispatch = createEventDispatcher<{ close: void; save: Event }>();

  let title = '';
  let description = '';
  let startTime = '';
  let endTime = '';
  let categoryId: number | null = null;
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
      
      if (event) {
        title = event.title;
        description = event.description || '';
        startTime = new Date(event.start_time).toISOString().slice(0, 16);
        endTime = event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : '';
        categoryId = event.category_id || null;
      } else {
        // New event defaults
        const now = new Date();
        startTime = now.toISOString().slice(0, 16);
        const end = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
        endTime = end.toISOString().slice(0, 16);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    isOpen = false;
    dispatch('close');
  }

  function handleSave() {
    if (!title.trim()) return;

    const updatedEvent: Event = {
      id: event?.id || 0,
      title: title.trim(),
      description: description.trim() || null,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      category_id: categoryId,
      category: categoryId ? categories.find(c => c.id === categoryId) || null : null,
    };

    dispatch('save', updatedEvent);
    handleClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick} on:keydown={(e) => e.key === 'Escape' && handleClose()}>
    {#if theme}
      <ThemedCard theme={theme} elevation="xl" padding="lg" variant="glass" class="modal-content">
        <div class="modal-header">
          <h2>{event ? 'Edit Event' : 'New Event'}</h2>
          <button class="close-button" on:click={handleClose} type="button">×</button>
        </div>

        {#if loading}
          <div class="loading">Loading...</div>
        {:else}
          <div class="modal-body">
            <div class="form-group">
              <label for="title">Title *</label>
              <input
                id="title"
                type="text"
                bind:value={title}
                placeholder="Event title"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="description">Description</label>
              <textarea
                id="description"
                bind:value={description}
                placeholder="Event description"
                class="form-textarea"
                rows="3"
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="startTime">Start Time *</label>
                <input
                  id="startTime"
                  type="datetime-local"
                  bind:value={startTime}
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label for="endTime">End Time</label>
                <input
                  id="endTime"
                  type="datetime-local"
                  bind:value={endTime}
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="category">Category</label>
              <select
                id="category"
                bind:value={categoryId}
                class="form-select"
              >
                <option value={null}>No category</option>
                {#each categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="modal-footer">
            <button class="button button-secondary" on:click={handleClose} type="button">
              Cancel
            </button>
            <button
              class="button button-primary"
              on:click={handleSave}
              disabled={!title.trim()}
              type="button"
            >
              {event ? 'Update' : 'Create'}
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
    animation: fadeIn 0.2s;
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
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s var(--animation-easing, ease);
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
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
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
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
    gap: 0.5rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: var(--font-weight-medium, 500);
    color: var(--text-primary);
  }

  .form-input,
  .form-textarea,
  .form-select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md, 0.5rem);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
    font-family: var(--font-family);
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px var(--accent-light, rgba(59, 130, 246, 0.1));
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
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

