<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { focusStore } from '../../stores/focusStore';
  import type { FocusSession } from '../../stores/focusStore';

  let session: FocusSession = {
    state: 'idle',
    startedAt: null,
    endsAt: null,
    remainingMs: 0,
    source: null,
    sourceId: null,
    title: '',
  };
  let focusModeEnabled = false;

  let unsubscribeSession: (() => void) | null = null;
  let unsubscribeMode: (() => void) | null = null;

  onMount(() => {
    unsubscribeSession = focusStore.session.subscribe((s) => {
      session = s;
    });
    unsubscribeMode = focusStore.focusModeEnabled.subscribe((enabled) => {
      focusModeEnabled = enabled;
    });
  });

  onDestroy(() => {
    unsubscribeSession?.();
    unsubscribeMode?.();
  });

  $: isVisible = focusModeEnabled || session.state === 'running' || session.state === 'paused';

  function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function getProgress(): number {
    if (session.state === 'idle' || !session.startedAt || !session.endsAt) {
      return 0;
    }

    const total = session.endsAt.getTime() - session.startedAt.getTime();
    if (total <= 0) return 0;

    const elapsed = total - session.remainingMs;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  function handlePause() {
    focusStore.pause();
  }

  function handleResume() {
    focusStore.resume();
  }

  function handleFinish() {
    if (session.state === 'running') {
      focusStore.finish('completed');
    } else {
      focusStore.finish('canceled');
    }
  }

  $: subtitle = session.source === 'task' ? 'Task' : session.source === 'block' ? 'Scheduled Block' : '';
</script>

{#if isVisible}
  <div class="focus-overlay" role="status" aria-live="polite">
    <div class="focus-content">
      <div class="focus-header">
        <div>
          <h3 class="focus-title">{session.title || 'Focus Mode'}</h3>
          {#if subtitle}
            <p class="focus-subtitle">{subtitle}</p>
          {/if}
        </div>
      </div>

      {#if session.state === 'running' || session.state === 'paused'}
        <div class="focus-timer">
          <div class="timer-display">{formatTime(session.remainingMs)}</div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: {getProgress()}%;"></div>
          </div>
        </div>

        <div class="focus-actions">
          {#if session.state === 'running'}
            <button class="btn-pause" on:click={handlePause} aria-label="Pause focus session">
              Pause
            </button>
          {:else if session.state === 'paused'}
            <button class="btn-resume" on:click={handleResume} aria-label="Resume focus session">
              Resume
            </button>
          {/if}
          <button class="btn-finish" on:click={handleFinish} aria-label="Finish focus session">
            Finish
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .focus-overlay {
    position: fixed;
    top: 80px;
    right: 16px;
    z-index: 1000;
    pointer-events: auto;
    max-width: 320px;
  }

  .focus-content {
    background: var(--surface-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(8px);
  }

  .focus-header {
    margin-bottom: 12px;
  }

  .focus-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.3;
  }

  .focus-subtitle {
    margin: 4px 0 0 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .focus-timer {
    margin-bottom: 12px;
  }

  .timer-display {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--accent);
    text-align: center;
    margin-bottom: 8px;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.05em;
  }

  .progress-bar-container {
    height: 4px;
    background: var(--surface-1);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-sm);
    transition: width 250ms ease-out;
  }

  .focus-actions {
    display: flex;
    gap: 8px;
  }

  .btn-pause,
  .btn-resume,
  .btn-finish {
    flex: 1;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease-out, border-color 150ms ease-out, transform 150ms ease-out;
  }

  .btn-pause:hover,
  .btn-resume:hover {
    background: var(--surface-0);
    border-color: var(--border-light);
  }

  .btn-resume {
    background: var(--accent);
    color: var(--accent-text, white);
    border-color: var(--accent);
  }

  .btn-resume:hover {
    background: var(--accent-hover, var(--accent));
    filter: brightness(1.05);
  }

  .btn-finish {
    background: var(--surface-1);
  }

  .btn-finish:hover {
    background: var(--surface-0);
    border-color: var(--border-light);
  }

  .btn-pause:active,
  .btn-resume:active,
  .btn-finish:active {
    transform: scale(0.98);
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-bar {
      transition: none;
    }
    .btn-pause,
    .btn-resume,
    .btn-finish {
      transition: none;
    }
  }
</style>

