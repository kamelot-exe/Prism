import { writable } from 'svelte/store';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT = 3200;

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  const remove = (id: number) => {
    update((toasts) => toasts.filter((t) => t.id !== id));
  };

  const show = (type: ToastType, message: string, timeoutMs = DEFAULT_TIMEOUT) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    update((toasts) => [...toasts, { id, type, message, timeoutMs }]);
    setTimeout(() => remove(id), timeoutMs);
    return id;
  };

  return {
    subscribe,
    show,
    remove,
    showSuccess: (message: string, timeoutMs?: number) => show('success', message, timeoutMs),
    showError: (message: string, timeoutMs?: number) => show('error', message, timeoutMs),
    showInfo: (message: string, timeoutMs?: number) => show('info', message, timeoutMs),
    showWarning: (message: string, timeoutMs?: number) => show('warning', message, timeoutMs),
  };
}

export const toastStore = createToastStore();
