<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ColorPicker from './ColorPicker.svelte';

  export let isOpen = false;
  export let initialName = '';
  export let initialColor = '#7ce7ff';

  const dispatch = createEventDispatcher<{ save: { name: string; color: string }; cancel: void }>();

  let name = initialName;
  let color = initialColor;
  let isSaving = false;
  let nameInput: HTMLInputElement | null = null;

  $: if (isOpen) {
    name = initialName;
    color = initialColor;
    isSaving = false;
    if (nameInput) nameInput.focus();
  }

  function save() {
    if (!name.trim()) return;
    isSaving = true;
    dispatch('save', { name, color });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('cancel');
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  }
</script>

{#if isOpen}
<div class="backdrop" role="presentation" on:keydown={handleKeydown} tabindex="-1">
  <button class="scrim" aria-label="Close" on:click={() => dispatch('cancel')}></button>
  <div class="modal elevated float-in" role="dialog" aria-modal="true">
    <header>
      <div>
        <p class="eyebrow">Category</p>
        <h3>{initialName ? 'Edit category' : 'New category'}</h3>
      </div>
      <button class="ghost" on:click={() => dispatch('cancel')}>Close</button>
    </header>

    <div class="body">
      <label>
        <span>Name</span>
        <input bind:this={nameInput} type="text" placeholder="Category name" bind:value={name} />
      </label>
      <div class="picker">
        <ColorPicker bind:value={color} />
      </div>
    </div>

  <footer>
    <button class="ghost" on:click={() => dispatch('cancel')}>Cancel</button>
    <button class="primary" on:click={save} disabled={isSaving} aria-busy={isSaving}>
      {#if isSaving}<span class="spinner"></span>{/if}
      <span>Save</span>
    </button>
  </footer>
  </div>
</div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop, rgba(0,0,0,0.6));
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 80;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
  }
  .modal {
    width: min(600px, 100%);
    padding: 14px;
    border-radius: var(--radius-lg);
    color: var(--text);
    background: var(--surface-0);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    animation: modalIn 160ms ease;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  h3 { margin: 0; }
  .body { display: grid; gap: 12px; margin-top: 12px; }
  label { display: grid; gap: 0.35rem; color: var(--text-secondary); }
  input {
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--text);
  }
  input:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
  .picker {
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 12px;
  }
  .ghost, .primary {
    border-radius: var(--radius-md);
    padding: 10px 12px;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  }
  .ghost { background: var(--surface-1); color: var(--text); }
  .ghost:hover { background: var(--surface-0); border-color: var(--border-light); box-shadow: var(--shadow-sm); }
  .primary {
    background: linear-gradient(135deg, var(--accent-2, var(--accent)), var(--accent));
    color: var(--text);
    font-weight: 700;
    box-shadow: var(--shadow-sm);
  }
  .primary:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }

  @keyframes modalIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
