<script lang="ts">
  import { settingsStore, type ThemeName } from '../stores/settings';
  import { listCategories, createCategory, type Category } from '../lib/api';
  import { onMount } from 'svelte';
  import ThemePreview from './ThemePreview.svelte';
  import ColorPicker from './ColorPicker.svelte';

  let categories: Category[] = [];
  let newCategoryName = '';
  let newCategoryColor = '#3b82f6';
  let loading = false;

  $: theme = $settingsStore.theme;
  $: firstDayOfWeek = $settingsStore.firstDayOfWeek;
  $: timeFormat = $settingsStore.timeFormat;

  const availableThemes: ThemeName[] = [
    'light',
    'dark',
    'glassmorphism',
    'avant-garde',
    'brutalism',
    'aurora-vibe',
    'auto'
  ];

  // Load theme on mount
  onMount(async () => {
    await settingsStore.applyTheme($settingsStore.theme);
  });

  onMount(async () => {
    await loadCategories();
  });

  async function loadCategories() {
    try {
      categories = await listCategories();
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async function handleThemeSelect(themeName: string) {
    await settingsStore.setTheme(themeName as ThemeName);
  }

  function handleColorChange(event: CustomEvent<string>) {
    newCategoryColor = event.detail;
  }

  async function handleFirstDayOfWeekChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    await settingsStore.saveSettings({ firstDayOfWeek: target.value as 'monday' | 'sunday' });
  }

  async function handleTimeFormatChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    await settingsStore.saveSettings({ timeFormat: target.value as '12h' | '24h' });
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    
    loading = true;
    try {
      await createCategory(newCategoryName, newCategoryColor);
      newCategoryName = '';
      newCategoryColor = '#3b82f6';
      await loadCategories();
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="settings">
  <h1>Settings</h1>

  <section class="settings-section">
    <h2>Appearance</h2>
    
    <div class="themes-grid">
      {#each availableThemes as themeOption}
        <ThemePreview
          themeName={themeOption}
          selected={theme === themeOption}
          onSelect={handleThemeSelect}
        />
      {/each}
    </div>
  </section>

  <section class="settings-section">
    <h2>Calendar</h2>
    
    <div class="setting-item">
      <label for="firstDayOfWeek">First Day of Week</label>
      <select id="firstDayOfWeek" value={firstDayOfWeek} on:change={handleFirstDayOfWeekChange}>
        <option value="monday">Monday</option>
        <option value="sunday">Sunday</option>
      </select>
    </div>

    <div class="setting-item">
      <label for="timeFormat">Time Format</label>
      <select id="timeFormat" value={timeFormat} on:change={handleTimeFormatChange}>
        <option value="12h">12-hour</option>
        <option value="24h">24-hour</option>
      </select>
    </div>
  </section>

  <section class="settings-section">
    <h2>Categories</h2>
    
    <div class="category-list">
      {#each categories as category}
        <div class="category-item">
          <div class="category-color" style="background-color: {category.color};"></div>
          <span class="category-name">{category.name}</span>
        </div>
      {/each}
    </div>

    <div class="create-category">
      <input
        type="text"
        placeholder="Category name"
        bind:value={newCategoryName}
        class="category-input"
      />
      <ColorPicker
        bind:value={newCategoryColor}
        label=""
        showLabel={false}
        on:change={handleColorChange}
      />
      <button
        on:click={handleCreateCategory}
        disabled={loading || !newCategoryName.trim()}
        class="create-button"
      >
        {loading ? 'Creating...' : 'Create Category'}
      </button>
    </div>
  </section>
</div>

<style>
  .settings {
    max-width: 800px;
    margin: 0 auto;
  }

  .settings h1 {
    margin-bottom: 2rem;
    color: var(--text-primary);
  }

  .settings-section {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .settings-section h2 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: var(--text-primary);
    font-size: 1.25rem;
  }

  .setting-item {
    margin-bottom: 1.5rem;
  }

  .setting-item:last-child {
    margin-bottom: 0;
  }

  .setting-item label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .setting-item select {
    width: 100%;
    max-width: 300px;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
    cursor: pointer;
  }

  .setting-item select:hover {
    border-color: var(--accent-color);
  }

  .category-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .category-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
  }

  .category-color {
    width: 16px;
    height: 16px;
    border-radius: 50%;
  }

  .category-name {
    color: var(--text-primary);
  }

  .themes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .create-category {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
  }

  .category-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
  }

  .color-input {
    width: 50px;
    height: 40px;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .create-button {
    padding: 0.5rem 1.5rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .create-button:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .create-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

