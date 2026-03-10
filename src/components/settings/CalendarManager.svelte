<script lang="ts">
  import { calendarsStore, type Calendar, type NewCalendarInput } from '../../stores/calendarsStore';
  import { toastStore } from '../../stores/toastStore';

  const PRESET_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ];

  let isAdding = false;
  let editingId: string | null = null;

  // ── Add form ──
  let addName = '';
  let addColor = PRESET_COLORS[0];
  let addNameError: string | null = null;

  // ── Edit form ──
  let editName = '';
  let editColor = '#3b82f6';
  let editNameError: string | null = null;

  function startAdd() {
    isAdding = true;
    addName = '';
    addColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    addNameError = null;
  }

  function cancelAdd() {
    isAdding = false;
    addNameError = null;
  }

  function handleAdd() {
    if (!addName.trim()) {
      addNameError = 'Name is required';
      return;
    }
    const input: NewCalendarInput = { name: addName.trim(), color: addColor };
    calendarsStore.add(input);
    toastStore.showSuccess(`Calendar "${addName.trim()}" created`);
    isAdding = false;
    addName = '';
  }

  function startEdit(cal: Calendar) {
    editingId = cal.id;
    editName = cal.name;
    editColor = cal.color;
    editNameError = null;
  }

  function cancelEdit() {
    editingId = null;
    editNameError = null;
  }

  function handleEdit(id: string) {
    if (!editName.trim()) {
      editNameError = 'Name is required';
      return;
    }
    calendarsStore.edit(id, { name: editName.trim(), color: editColor });
    toastStore.showSuccess('Calendar updated');
    editingId = null;
  }

  function handleRemove(cal: Calendar) {
    if (cal.isPrimary) {
      toastStore.showError('Cannot remove the primary calendar');
      return;
    }
    if (!confirm(`Remove calendar "${cal.name}"? Events linked to it will keep their data.`)) return;
    const ok = calendarsStore.remove(cal.id);
    if (ok) toastStore.showSuccess(`"${cal.name}" removed`);
  }

  function handleToggleVisibility(cal: Calendar) {
    calendarsStore.toggleVisibility(cal.id);
  }

  function handleSetPrimary(cal: Calendar) {
    calendarsStore.setPrimary(cal.id);
    toastStore.showSuccess(`"${cal.name}" is now the primary calendar`);
  }
</script>

<section class="calendar-manager">
  <div class="section-header">
    <div>
      <h3>My Calendars</h3>
      <p class="subtitle">Organise events across multiple calendars</p>
    </div>
    {#if !isAdding}
      <button class="btn-add" on:click={startAdd}>+ New Calendar</button>
    {/if}
  </div>

  {#if isAdding}
    <div class="add-form card">
      <h4>New Calendar</h4>
      <div class="form-row">
        <div class="field">
          <label for="add-cal-name">Name <span class="required">*</span></label>
          <input
            id="add-cal-name"
            type="text"
            bind:value={addName}
            placeholder="e.g. Family"
            class:error={addNameError !== null}
            maxlength="60"
          />
          {#if addNameError}
            <span class="error-msg">{addNameError}</span>
          {/if}
        </div>
        <div class="field color-field">
          <label>Color</label>
          <div class="color-swatches">
            {#each PRESET_COLORS as color}
              <button
                type="button"
                class="swatch"
                class:active={addColor === color}
                style="background:{color}"
                title={color}
                on:click={() => (addColor = color)}
                aria-label="Pick color {color}"
              ></button>
            {/each}
            <input type="color" bind:value={addColor} class="color-input" title="Custom color" />
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-ghost" on:click={cancelAdd}>Cancel</button>
        <button class="btn-primary" on:click={handleAdd}>Create</button>
      </div>
    </div>
  {/if}

  <ul class="cal-list">
    {#each $calendarsStore as cal (cal.id)}
      <li class="cal-item" class:is-hidden={!cal.visible}>
        {#if editingId === cal.id}
          <!-- Edit mode -->
          <div class="edit-row">
            <span class="color-dot" style="background:{editColor}"></span>
            <input
              type="text"
              bind:value={editName}
              class:error={editNameError !== null}
              maxlength="60"
              aria-label="Calendar name"
            />
            <div class="color-swatches small">
              {#each PRESET_COLORS as color}
                <button
                  type="button"
                  class="swatch"
                  class:active={editColor === color}
                  style="background:{color}"
                  on:click={() => (editColor = color)}
                  aria-label="Pick color {color}"
                ></button>
              {/each}
              <input type="color" bind:value={editColor} class="color-input" />
            </div>
            {#if editNameError}
              <span class="error-msg">{editNameError}</span>
            {/if}
            <div class="edit-actions">
              <button class="btn-ghost sm" on:click={cancelEdit}>Cancel</button>
              <button class="btn-primary sm" on:click={() => handleEdit(cal.id)}>Save</button>
            </div>
          </div>
        {:else}
          <!-- View mode -->
          <button
            class="visibility-toggle"
            title={cal.visible ? 'Hide calendar' : 'Show calendar'}
            aria-label={cal.visible ? `Hide ${cal.name}` : `Show ${cal.name}`}
            on:click={() => handleToggleVisibility(cal)}
          >
            <span class="color-dot" style="background:{cal.color}"></span>
          </button>

          <div class="cal-info">
            <span class="cal-name">{cal.name}</span>
            <span class="cal-meta">
              {cal.source === 'local' ? 'Local' : cal.source}
              {#if cal.isPrimary}<span class="badge primary">Primary</span>{/if}
              {#if !cal.visible}<span class="badge hidden">Hidden</span>{/if}
            </span>
          </div>

          <div class="cal-actions">
            {#if !cal.isPrimary}
              <button
                class="btn-icon"
                title="Set as primary"
                on:click={() => handleSetPrimary(cal)}
              >★</button>
            {/if}
            <button class="btn-icon" title="Edit" on:click={() => startEdit(cal)}>✎</button>
            {#if !cal.isPrimary}
              <button
                class="btn-icon danger"
                title="Remove"
                on:click={() => handleRemove(cal)}
              >✕</button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .calendar-manager {
    display: grid;
    gap: 16px;
  }

  .section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
  }

  .subtitle {
    margin: 2px 0 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  h4 {
    margin: 0 0 12px;
    font-size: 1rem;
    color: var(--text);
  }

  .card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px;
  }

  .add-form {
    animation: slideDown 160ms ease;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .field {
    display: grid;
    gap: 6px;
  }

  .field label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .required {
    color: #ef4444;
  }

  input[type="text"] {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-0);
    color: var(--text);
    font-size: 0.95rem;
  }

  input[type="text"].error {
    border-color: #ef4444;
  }

  .error-msg {
    font-size: 0.75rem;
    color: #ef4444;
  }

  .color-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .color-swatches.small .swatch {
    width: 18px;
    height: 18px;
  }

  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 150ms ease, border-color 150ms ease;
  }

  .swatch.active,
  .swatch:hover {
    transform: scale(1.15);
    border-color: var(--text);
  }

  .color-input {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    background: none;
  }

  .form-actions,
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .edit-actions {
    margin-top: 0;
  }

  .cal-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  .cal-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-1);
    border: 1px solid var(--border);
    transition: opacity 150ms ease;
  }

  .cal-item.is-hidden {
    opacity: 0.5;
  }

  .edit-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    flex-wrap: wrap;
  }

  .visibility-toggle {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .color-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  .cal-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cal-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cal-meta {
    font-size: 0.78rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge.primary {
    background: var(--accent-light, rgba(59, 130, 246, 0.15));
    color: var(--accent);
  }

  .badge.hidden {
    background: var(--surface-0);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }

  .cal-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .btn-add,
  .btn-primary,
  .btn-ghost {
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    transition: all 150ms ease;
  }

  .btn-add {
    background: var(--accent);
    color: var(--bg, white);
    border-color: var(--accent);
  }

  .btn-add:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-primary {
    background: var(--accent);
    color: var(--bg, white);
    border-color: var(--accent);
  }

  .btn-primary.sm {
    padding: 6px 10px;
    font-size: 0.85rem;
  }

  .btn-ghost {
    background: var(--surface-0);
    color: var(--text);
  }

  .btn-ghost.sm {
    padding: 6px 10px;
    font-size: 0.85rem;
  }

  .btn-icon {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-0);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    transition: all 150ms ease;
  }

  .btn-icon:hover {
    background: var(--surface-1);
    color: var(--text);
  }

  .btn-icon.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-color: #ef4444;
  }
</style>
