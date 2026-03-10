<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { toastStore, type Toast } from '../../stores/toastStore';

  let toasts: Toast[] = [];
  const unsubscribe = toastStore.subscribe((list) => (toasts = list));

  // Cleanup subscription if component is destroyed
  onDestroy(unsubscribe);
</script>

<div class="toast-layer" aria-live="polite" aria-atomic="true">
  {#each toasts as toast (toast.id)}
    <div
      class={`toast ${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      transition:fade={{ duration: 150 }}
    >
      <span>{toast.message}</span>
    </div>
  {/each}
</div>

<style>
  .toast-layer {
    position: fixed;
    top: 12px;
    right: 12px;
    display: grid;
    gap: 8px;
    z-index: 2000;
    pointer-events: none;
  }
  .toast {
    min-width: 240px;
    max-width: 320px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    color: var(--text);
    box-shadow: var(--shadow-md);
    pointer-events: auto;
    backdrop-filter: blur(6px);
    border: 1px solid var(--border);
    font-size: 0.95rem;
  }
  .toast.success {
    background: var(--accent);
    color: var(--text-on-accent, #0b1021);
    border-color: transparent;
  }
  .toast.error {
    background: var(--error-bg, #ff6b6b);
    color: var(--error-text, #1d0b0b);
    border-color: transparent;
  }
  .toast.info {
    background: var(--surface-1);
    color: var(--text);
  }
  .toast.warning {
    background: rgba(251, 146, 60, 0.15);
    color: var(--text);
    border-color: rgba(251, 146, 60, 0.3);
  }
</style>
