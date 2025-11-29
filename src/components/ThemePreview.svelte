<script lang="ts">
  import { loadTheme, type Theme } from '../lib/theme';
  import ThemedCard from './ThemedCard.svelte';

  export let themeName: string;
  export let selected = false;
  export let onSelect: (themeName: string) => void;

  let theme: Theme | null = null;
  let loading = true;

  $: if (themeName) {
    loadThemeData();
  }

  async function loadThemeData() {
    loading = true;
    try {
      theme = await loadTheme(themeName as any);
    } catch (error) {
      console.error(`Failed to load theme ${themeName}:`, error);
    } finally {
      loading = false;
    }
  }

  function handleClick() {
    onSelect(themeName);
  }
</script>

<button
  class="theme-preview"
  class:selected
  on:click={handleClick}
  style:background={theme?.['bg-primary']}
  style:border-color={theme?.['border-color']}
  style:border-radius={theme?.['border-radius-md']}
  style:box-shadow={selected ? theme?.['shadow-lg'] : theme?.['shadow-sm']}
>
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if theme}
    <div class="theme-header">
      <h3 style:color={theme['text-primary']}>{theme.name}</h3>
      {#if theme.description}
        <p class="description" style:color={theme['text-secondary']}>
          {theme.description}
        </p>
      {/if}
    </div>

    <div class="theme-preview-content">
      <ThemedCard theme={theme} class="preview-card">
        <div class="preview-item" style:background={theme['accent-color']}>
          <span style:color="white">Accent</span>
        </div>
        <div class="preview-item" style:background={theme['success-color']}>
          <span style:color="white">Success</span>
        </div>
        <div class="preview-item" style:background={theme['error-color']}>
          <span style:color="white">Error</span>
        </div>
      </ThemedCard>

      <div class="color-swatches">
        <div
          class="swatch"
          style:background={theme['bg-primary']}
          style:border-color={theme['border-color']}
          title="Primary Background"
        ></div>
        <div
          class="swatch"
          style:background={theme['bg-secondary']}
          style:border-color={theme['border-color']}
          title="Secondary Background"
        ></div>
        <div
          class="swatch"
          style:background={theme['accent-color']}
          title="Accent"
        ></div>
        <div
          class="swatch"
          style:background={theme['text-primary']}
          title="Primary Text"
        ></div>
      </div>
    </div>
  {/if}
</button>

<style>
  .theme-preview {
    width: 100%;
    padding: 1.5rem;
    border: 2px solid;
    background: var(--bg-primary);
    cursor: pointer;
    transition: all var(--animation-duration, 0.3s) var(--animation-easing, ease);
    text-align: left;
    font-family: var(--font-family);
  }

  .theme-preview:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md) !important;
  }

  .theme-preview.selected {
    border-color: var(--accent-color) !important;
    box-shadow: var(--shadow-lg) !important;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .theme-header {
    margin-bottom: 1rem;
  }

  .theme-header h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: var(--font-weight-semibold, 600);
  }

  .description {
    margin: 0;
    font-size: 0.875rem;
  }

  .theme-preview-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .preview-card {
    min-height: 80px;
  }

  .preview-item {
    padding: 0.5rem;
    border-radius: var(--border-radius-sm, 0.375rem);
    font-size: 0.75rem;
    font-weight: var(--font-weight-medium, 500);
  }

  .color-swatches {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .swatch {
    width: 32px;
    height: 32px;
    border-radius: var(--border-radius-sm, 0.375rem);
    border: 1px solid;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .swatch:hover {
    transform: scale(1.1);
  }
</style>

