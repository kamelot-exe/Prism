<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '../stores/settings';
  import type { ThemeName } from '../lib/theme';
  import { listCategories, createCategory, updateCategory, deleteCategory, type Category } from '../lib/api';

  export let isOpen = false;

  const sections = ['general', 'themes', 'categories', 'productivity', 'google-sync'] as const;
  type Section = typeof sections[number];
  let active: Section = 'general';

  let categories: Category[] = [];
  let newCategory: Category = { name: '', color_hex: '#7c3aed' };
  const channels: ('r' | 'g' | 'b')[] = ['r', 'g', 'b'];

  const themeOptions: { id: ThemeName; title: string; description: string }[] = [
    { id: 'glassmorphism', title: 'Glassmorphism', description: 'Translucent with depth' },
    { id: 'aurora-neon', title: 'Aurora Neon', description: 'Dark with neon glow' },
    { id: 'claymorphism-soft', title: 'Claymorphism Soft', description: 'Soft 3D, tactile' },
    { id: 'cyber-minimal-grid', title: 'Cyber Minimal Grid', description: 'Ultra-clean grids' },
    { id: 'sunset-fade', title: 'Sunset Fade', description: 'Warm gradient sunset' },
    { id: 'blueprint-technical', title: 'Blueprint Technical', description: 'Engineering blueprint' },
  ];

  onMount(loadCategories);

  async function loadCategories() {
    categories = await listCategories().catch(() => []);
  }

  function hexToRgb(hex: string) {
    const sanitized = hex.replace('#', '');
    const bigint = parseInt(sanitized, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  function rgbToHex(r: number, g: number, b: number) {
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function updateFromRgb(field: 'r' | 'g' | 'b', value: number, target: Category) {
    const rgb = hexToRgb(target.color_hex || '#000000');
    rgb[field] = Math.min(255, Math.max(0, value));
    target.color_hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  async function saveCategory(category: Category) {
    if (category.id) {
      const updated = await updateCategory({ id: category.id, name: category.name, color_hex: category.color_hex });
      categories = categories.map((c) => (c.id === category.id ? updated : c));
    } else {
      const created = await createCategory({ name: category.name, color_hex: category.color_hex });
      categories = [...categories, created];
      newCategory = { name: '', color_hex: '#7c3aed' };
    }
  }

  async function removeCategory(id: number) {
    await deleteCategory(id);
    categories = categories.filter((c) => c.id !== id);
  }

  function handleFirstDayChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'monday' | 'sunday';
    settingsStore.saveSettings({ firstDayOfWeek: value });
  }

  function handleTimeFormatChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as '12h' | '24h';
    settingsStore.saveSettings({ timeFormat: value });
  }

  function handleCategoryNameInput(category: Category, event: Event) {
    category.name = (event.target as HTMLInputElement).value;
  }

  function handleCategoryChannelChange(category: Category, channel: 'r' | 'g' | 'b', event: Event) {
    updateFromRgb(channel, Number((event.target as HTMLInputElement).value), category);
  }

  function handleNewCategoryChannelChange(channel: 'r' | 'g' | 'b', event: Event) {
    updateFromRgb(channel, Number((event.target as HTMLInputElement).value), newCategory);
  }
</script>

{#if isOpen}
<div class="settings-backdrop">
  <button
    class="scrim"
    type="button"
    aria-label="Close settings"
    on:click={() => (isOpen = false)}
  ></button>
  <div class="settings" role="dialog" aria-modal="true" tabindex="-1">
    <header>
      <div>
        <p>Settings</p>
        <h2>Shape Prism to your workflow</h2>
      </div>
      <button class="ghost" on:click={() => (isOpen = false)}>✕</button>
    </header>

    <div class="layout">
      <nav>
        {#each sections as section}
          <button class:active={active === section} on:click={() => (active = section)}>
            {section.replace('-', ' ')}
          </button>
        {/each}
      </nav>

      <div class="content">
        {#if active === 'general'}
          <div class="card">
            <h3>General</h3>
            <p class="muted">Set week start, time format and defaults.</p>
            <div class="grid">
              <label>First day of week
                <select value={$settingsStore.firstDayOfWeek} on:change={handleFirstDayChange}>
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </label>
              <label>Time format
                <select value={$settingsStore.timeFormat} on:change={handleTimeFormatChange}>
                  <option value="24h">24 hours</option>
                  <option value="12h">12 hours</option>
                </select>
              </label>
            </div>
          </div>
        {:else if active === 'themes'}
          <div class="card">
            <h3>Theme collection</h3>
            <p class="muted">Six curated visual systems.</p>
            <div class="theme-grid">
              {#each themeOptions as theme}
                <button class:active={$settingsStore.theme === theme.id} on:click={() => settingsStore.setTheme(theme.id)}>
                  <span>{theme.title}</span>
                  <small>{theme.description}</small>
                </button>
              {/each}
            </div>
          </div>
        {:else if active === 'categories'}
          <div class="card">
            <h3>Categories</h3>
            <p class="muted">Manage colors and naming from one place.</p>
            <div class="category-list">
              {#each categories as category}
                <div class="category-row">
                  <div class="color-dot" style={`background:${category.color_hex}`}></div>
                  <input value={category.name} on:input={(event) => handleCategoryNameInput(category, event)} />
                  <input type="color" bind:value={category.color_hex} />
                  <div class="rgb">
                    {#each channels as channel}
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={hexToRgb(category.color_hex)[channel]}
                        on:input={(event) => handleCategoryChannelChange(category, channel, event)}
                      />
                    {/each}
                  </div>
                  <button class="ghost" on:click={() => saveCategory(category)}>Save</button>
                  <button class="ghost danger" on:click={() => category.id && removeCategory(category.id)}>Delete</button>
                </div>
              {/each}
            </div>
            <div class="new-category">
              <input placeholder="Name" bind:value={newCategory.name} />
              <input type="color" bind:value={newCategory.color_hex} />
              <div class="rgb">
                {#each channels as channel}
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={hexToRgb(newCategory.color_hex)[channel]}
                    on:input={(event) => handleNewCategoryChannelChange(channel, event)}
                  />
                {/each}
              </div>
              <button class="primary" on:click={() => saveCategory(newCategory)}>Add category</button>
            </div>
          </div>
        {:else if active === 'productivity'}
          <div class="card">
            <h3>Productivity</h3>
            <p class="muted">Configure Pomodoro, Quick Add defaults and task handling.</p>
            <div class="grid">
              <label>Pomodoro length
                <input type="number" min="10" max="90" value="25" />
              </label>
              <label>Break length
                <input type="number" min="5" max="30" value="5" />
              </label>
              <label>Default reminder (minutes)
                <input type="number" min="0" step="5" value="15" />
              </label>
            </div>
          </div>
        {:else if active === 'google-sync'}
          <div class="card">
            <h3>Google Sync</h3>
            <p class="muted">Authenticate and manage sync state.</p>
            <div class="grid">
              <button class="primary">Connect Google</button>
              <button class="ghost">Disconnect</button>
              <div class="status">Status: waiting</div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  .settings-backdrop { position: fixed; inset: 0; background: var(--modal-backdrop, rgba(0,0,0,0.5)); display: flex; justify-content: center; align-items: center; padding: 2rem; z-index: 50; }
  .scrim { position: absolute; inset: 0; background: transparent; border: none; padding: 0; }
  .settings { width: min(1200px, 100%); background: var(--modal-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--modal-shadow); padding: 1.5rem; color: var(--text); display: grid; gap: 1rem; }
  header { display: flex; justify-content: space-between; align-items: center; }
  header p { margin: 0; color: var(--text-muted); }
  header h2 { margin: 0; }
  .layout { display: grid; grid-template-columns: 220px 1fr; gap: 1rem; }
  nav { display: grid; gap: 0.5rem; background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border); }
  nav button { text-align: left; border: none; background: transparent; padding: 0.7rem; border-radius: var(--radius-md); color: var(--text); cursor: pointer; }
  nav button.active { background: var(--accent-light); }
  .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg); padding: 1rem; box-shadow: var(--shadow-xs); display: grid; gap: 1rem; }
  .muted { color: var(--text-muted); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  label { display: grid; gap: 0.35rem; color: var(--text-secondary); }
  input, select { padding: 0.7rem 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); }
  .theme-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
  .theme-grid button { text-align: left; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem; background: var(--bg-secondary); color: var(--text); cursor: pointer; }
  .theme-grid button.active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-light); }
  .category-list { display: grid; gap: 0.5rem; }
  .category-row { display: grid; grid-template-columns: 22px 1fr 80px 1fr auto auto; align-items: center; gap: 0.5rem; }
  .color-dot { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border); }
  .rgb { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem; }
  .new-category { display: grid; grid-template-columns: 1fr 100px 1fr auto; align-items: center; gap: 0.5rem; margin-top: 0.75rem; }
  .primary, .ghost { padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); cursor: pointer; background: var(--button-bg); color: var(--button-text); }
  .primary:hover { background: var(--button-hover); }
  .ghost { background: transparent; color: var(--text); }
  .ghost:hover { background: var(--bg-hover); }
  .danger { color: #ef4444; }
  .status { color: var(--text-secondary); padding: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px solid var(--border); }
</style>
