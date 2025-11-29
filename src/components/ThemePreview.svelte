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
  style:background={theme?.bg}
  style:border-color={theme?.border}
  style:border-radius={theme?.['radius-md']}
  style:box-shadow={selected ? theme?.['shadow-lg'] : theme?.['shadow-sm']}
>
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if theme}
    <div class="theme-header">
      <h3 style:color={theme.text}>{theme.name}</h3>
      {#if theme.description}
        <p class="description" style:color={theme['text-secondary']}>
          {theme.description}
        </p>
      {/if}
    </div>

    <div class="theme-preview-content">
      <div class="preview-card" style:background={theme['card-bg']} style:border-color={theme['card-border']} style:border-radius={theme['radius-md']}>
        <div class="preview-item" style:background={theme.accent}>
          <span style:color="white">Accent</span>
        </div>
      </div>

      <div class="color-swatches">
        <div
          class="swatch"
          style:background={theme.bg}
          style:border-color={theme.border}
          title="Background"
        ></div>
        <div
          class="swatch"
          style:background={theme['bg-secondary']}
          style:border-color={theme.border}
          title="Secondary"
        ></div>
        <div
          class="swatch"
          style:background={theme.accent}
          title="Accent"
        ></div>
        <div
          class="swatch"
          style:background={theme.text}
          title="Text"
        ></div>
      </div>
    </div>
  {/if}
</button>

<style>
  .theme-preview {
    width: 100%;
    padding: var(--spacing-lg);
    border: 2px solid;
    cursor: pointer;
    transition: all var(--animation-duration) var(--animation-easing);
    text-align: left;
  }

  .theme-preview:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md) !important;
  }

  .theme-preview.selected {
    border-color: var(--accent) !important;
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

  .preview-card {
    padding: var(--spacing-md);
    border: 1px solid;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-item {
    padding: var(--spacing-sm);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
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

