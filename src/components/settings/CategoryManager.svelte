<script lang="ts">
  import { onMount } from 'svelte';
  import CategoryModal from './CategoryModal.svelte';
  import { categoryStore } from '../../stores/categoryStore';
  import type { Category } from '../../lib/api';

  let categories: Category[] = [];

  let modalOpen = false;
  let editing: Category | null = null;
  let draftName = '';
  let draftColor = '#7ce7ff';

  function openAdd() {
    editing = null;
    draftName = '';
    draftColor = '#7ce7ff';
    modalOpen = true;
  }

  function openEdit(category: Category) {
    editing = category;
    draftName = category.name;
    draftColor = category.color_hex || category.color || '#7ce7ff';
    modalOpen = true;
  }

  async function handleSave(event: CustomEvent<{ name: string; color: string }>) {
    const { name, color } = event.detail;
    try {
      if (editing) {
        await categoryStore.updateCategory(editing.id!, name, color);
      } else {
        await categoryStore.createCategory(name, color);
      }
      modalOpen = false;
    } catch (err) {
      console.error('Category save failed', err);
      modalOpen = false;
    }
  }

  async function handleDelete(category: Category) {
    if (!category.id) return;
    if (!confirm(`Delete category "${category.name}"? This won't remove events.`)) return;
    try {
      await categoryStore.deleteCategory(category.id);
    } catch (err) {
      console.error('Category delete failed', err);
    }
  }

  onMount(() => {
    const unsubscribe = categoryStore.subscribe((list) => (categories = list));
    (async () => {
      await categoryStore.loadCategories();
    })();
    return unsubscribe;
  });
</script>

<section class="category-manager">
  <header>
    <div>
      <p class="eyebrow">Categories</p>
      <h3>Organize with color</h3>
    </div>
    <button class="primary" on:click={openAdd}>Add Category</button>
  </header>

  <div class="list">
    {#each categories as category}
      <div class="row" style={`--category-color:${category.color}`}>
        <div class="identity">
          <span class="dot"></span>
          <span class="name">{category.name}</span>
        </div>
        <div class="actions">
          <button class="ghost tiny" on:click={() => openEdit(category)}>Edit</button>
          <button class="ghost tiny danger" on:click={() => handleDelete(category)}>Delete</button>
        </div>
      </div>
    {/each}
  </div>

  <CategoryModal
    isOpen={modalOpen}
    initialName={draftName}
    initialColor={draftColor}
    on:save={handleSave}
    on:cancel={() => (modalOpen = false)}
  />
</section>

<style>
  .category-manager { display: grid; gap: 12px; }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  h3 { margin: 0.1rem 0 0 0; }
  .primary {
    border-radius: var(--radius-md);
    padding: 10px 12px;
    border: 1px solid var(--accent);
    background: linear-gradient(135deg, var(--accent-2, var(--accent)), var(--accent));
    color: var(--text);
    cursor: pointer;
    font-weight: 700;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 140ms ease, transform 140ms ease, filter 140ms ease;
  }
  .primary:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); filter: brightness(1.05); }
  .list { display: grid; gap: 10px; }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-1);
    box-shadow: var(--shadow-xs);
  }
  .identity { display: flex; align-items: center; gap: 10px; }
  .dot { width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--border-light); box-shadow: var(--shadow-xs); background: var(--category-color, var(--accent)); }
  .name { color: var(--text); font-weight: 600; }
  .actions { display: flex; gap: 8px; }
  .ghost {
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  }
  .ghost:hover { background: var(--surface-0); border-color: var(--border-light); box-shadow: var(--shadow-sm); }
  .ghost.tiny { font-size: 0.9rem; }
  .ghost.danger { color: var(--accent-danger, var(--accent)); border-color: var(--accent-danger, var(--border)); }
</style>
