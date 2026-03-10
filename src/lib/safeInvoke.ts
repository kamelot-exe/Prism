import { invoke } from '@tauri-apps/api/core';

export const isTauriEnvironment = (): boolean =>
  typeof window !== 'undefined' && typeof (window as any).__TAURI__ !== 'undefined';

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;

  if (err && typeof err === 'object') {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }

    try {
      const serialized = JSON.stringify(err);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch {
      // ignore JSON serialization issues and fall through
    }
  }

  return 'Unknown Tauri error';
}

export async function safeInvoke<T = unknown>(
  cmd: string,
  payload?: Record<string, unknown>
): Promise<T | null> {
  if (!isTauriEnvironment()) {
    console.warn(`Tauri runtime not available; skipped invoke(${cmd})`);
    return null;
  }

  try {
    return await invoke<T>(cmd, payload);
  } catch (err) {
    console.error('Invoke failed:', err);
    throw new Error(extractErrorMessage(err));
  }
}
