<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { commandStore } from '../../stores/commandStore';
  import { parseCommand } from '../../lib/command/commandParser';
  import type { ParsedCommand } from '../../lib/command/commandTypes';
  import { modalBehavior } from '../../lib/modalBehavior';

  export let currentDate: Date = new Date();

  let isOpen = false;
  let searchQuery = '';
  let parsedCommand: ParsedCommand | null = null;
  let inputElement: HTMLInputElement | null = null;

  let unsubscribeCommand: (() => void) | null = null;

  onMount(() => {
    unsubscribeCommand = commandStore.subscribe((open) => {
      isOpen = open;
      if (!open) {
        searchQuery = '';
        parsedCommand = null;
      }
    });
  });

  onDestroy(() => {
    unsubscribeCommand?.();
  });

  $: if (searchQuery.trim()) {
    parsedCommand = parseCommand(searchQuery, currentDate);
  } else {
    parsedCommand = null;
  }

  function close() {
    commandStore.close();
  }

  async function execute() {
    if (!parsedCommand || parsedCommand.confidence < 0.4) {
      return;
    }

    await commandStore.execute(parsedCommand);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      execute();
    }
  }

  function formatDate(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
      return 'Today';
    }

    if (dateOnly.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
</script>

{#if isOpen}
  <div
    class="backdrop"
    role="presentation"
    tabindex="-1"
    use:modalBehavior={{ enabled: isOpen, onClose: close, initialFocus: () => inputElement }}
  >
    <button class="scrim" aria-label="Close command palette" on:click={close}></button>
    <div class="palette" role="dialog" aria-modal="true" aria-labelledby="command-palette-title" on:keydown={handleKeydown}>
      <div class="search-container">
        <div class="surface-copy">
          <p class="surface-label">Actions</p>
          <p class="surface-hint">Run actions or create from plain English. Use Search to find existing items.</p>
        </div>
        <label class="sr-only" id="command-palette-title" for="command-palette-input">Command palette</label>
        <input
          bind:this={inputElement}
          id="command-palette-input"
          type="text"
          placeholder="Run an action or create from plain English"
          bind:value={searchQuery}
          class="search-input"
        />
      </div>

      {#if parsedCommand && searchQuery.trim()}
        <div class="preview-container">
          {#if parsedCommand.confidence < 0.4}
            <div class="hint">
              <p>Try being more specific. Examples:</p>
              <ul>
                <li>"Meeting at 2pm tomorrow"</li>
                <li>"Focus on code review urgent"</li>
                <li>"Task: Review PR today"</li>
              </ul>
            </div>
          {:else}
            <div class="preview">
              <div class="preview-header">
                <span class="preview-type">{parsedCommand.type === 'event' ? 'Event' : 'Task'}</span>
                {#if parsedCommand.isFocus}
                  <span class="preview-badge focus">Focus</span>
                {/if}
                {#if parsedCommand.priority}
                  <span class="preview-badge priority-{parsedCommand.priority}">{parsedCommand.priority}</span>
                {/if}
              </div>
              <div class="preview-title">{parsedCommand.title || '(no title)'}</div>
              <div class="preview-details">
                {#if parsedCommand.date}
                  <span class="preview-chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {formatDate(parsedCommand.date)}
                  </span>
                {/if}
                {#if parsedCommand.startTime}
                  <span class="preview-chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {formatTime(parsedCommand.startTime)}
                  </span>
                {/if}
                {#if parsedCommand.durationMinutes}
                  <span class="preview-chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {parsedCommand.durationMinutes} min
                  </span>
                {/if}
              </div>
              <div class="preview-footer">
                <span class="confidence">Confidence: {Math.round(parsedCommand.confidence * 100)}%</span>
                <span class="hint-text">Press Enter to run or create</span>
              </div>
            </div>
          {/if}
        </div>
      {:else if !searchQuery.trim()}
        <div class="examples">
          <p class="examples-title">Try one of these:</p>
          <ul class="examples-list">
            <li>"Meeting with team at 2pm tomorrow"</li>
            <li>"Focus on code review urgent"</li>
            <li>"Task: Review PR today"</li>
            <li>"Call John at 10am for 30 min"</li>
          </ul>
        </div>
      {/if}
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
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop { animation: none; }
    .palette { animation: none; }
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
  }

  .palette {
    width: min(600px, 100%);
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    animation: slideUp 150ms ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .search-container {
    padding: 16px;
    border-bottom: 1px solid var(--border);
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

  .search-input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--text);
    font-size: 1rem;
    transition: border-color 150ms ease-out, outline 150ms ease-out;
  }

  .search-input:focus {
    outline: 2px solid var(--accent);
    border-color: var(--accent);
  }

  .preview-container {
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
  }

  .preview {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 16px;
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .preview-type {
    font-weight: 600;
    color: var(--accent);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preview-badge {
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .preview-badge.focus {
    background: var(--accent-light, var(--surface-0));
    color: var(--accent);
    border: 1px solid var(--accent);
  }

  .preview-badge.priority-urgent {
    background: rgba(220, 38, 38, 0.1);
    color: #dc2626;
  }

  .preview-badge.priority-high {
    background: rgba(234, 88, 12, 0.1);
    color: #ea580c;
  }

  .preview-badge.priority-low {
    background: rgba(107, 114, 128, 0.1);
    color: #6b7280;
  }

  .preview-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 12px;
    word-break: break-word;
  }

  .preview-details {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .preview-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .preview-chip svg {
    width: 14px;
    height: 14px;
  }

  .preview-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    font-size: 0.85rem;
  }

  .confidence,
  .hint-text {
    color: var(--text-muted);
  }

  .hint {
    padding: 16px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .hint p {
    margin: 0 0 12px 0;
    color: var(--text);
    font-weight: 500;
  }

  .hint ul,
  .examples-list {
    margin: 0;
    padding-left: 20px;
    color: var(--text-muted);
  }

  .hint li,
  .examples-list li {
    margin-bottom: 6px;
    font-size: 0.9rem;
  }

  .examples {
    padding: 16px;
  }

  .examples-title {
    margin: 0 0 12px 0;
    font-weight: 600;
    color: var(--text);
    font-size: 0.9rem;
  }
</style>
