import { writable, get } from 'svelte/store';
import { settingsStore } from './settings';
import { notify } from '../lib/notifications/notificationAdapter';
import { toastStore } from './toastStore';

export interface FocusSession {
  state: 'idle' | 'running' | 'paused';
  startedAt: Date | null;
  endsAt: Date | null;
  remainingMs: number;
  source: 'task' | 'block' | null;
  sourceId: number | string | null;
  title: string;
}

const STORAGE_KEY = 'prism_focus_session';

function loadFromStorage(): FocusSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (parsed.state === 'idle') return null;

    return {
      state: parsed.state,
      startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      remainingMs: parsed.remainingMs || 0,
      source: parsed.source || null,
      sourceId: parsed.sourceId || null,
      title: parsed.title || '',
    };
  } catch (err) {
    console.error('Failed to load focus session from storage', err);
    return null;
  }
}

function saveToStorage(session: FocusSession | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (!session || session.state === 'idle') {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: session.state,
        startedAt: session.startedAt?.toISOString() || null,
        endsAt: session.endsAt?.toISOString() || null,
        remainingMs: session.remainingMs,
        source: session.source,
        sourceId: session.sourceId,
        title: session.title,
      })
    );
  } catch (err) {
    console.error('Failed to save focus session to storage', err);
  }
}

function createFocusStore() {
  const initialSession = loadFromStorage();
  const { subscribe, set, update } = writable<FocusSession>(
    initialSession || {
      state: 'idle',
      startedAt: null,
      endsAt: null,
      remainingMs: 0,
      source: null,
      sourceId: null,
      title: '',
    }
  );

  const { subscribe: subscribeMode, set: setMode, update: updateMode } = writable<boolean>(false);

  let timerInterval: ReturnType<typeof setInterval> | null = null;
  const TICK_INTERVAL = 500;

  function getDefaultDuration(): number {
    const settings = get(settingsStore);
    return settings.productivity?.pomodoroFocus ?? 25;
  }

  function startTimer(): void {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
      update((session) => {
        if (session.state !== 'running') {
          return session;
        }

        if (!session.endsAt) {
          return session;
        }

        const now = Date.now();
        const remaining = session.endsAt.getTime() - now;

        if (remaining <= 0) {
          finish('timeup');
          return {
            ...session,
            state: 'idle',
            remainingMs: 0,
          };
        }

        const updated = {
          ...session,
          remainingMs: remaining,
        };

        saveToStorage(updated);
        return updated;
      });
    }, TICK_INTERVAL);
  }

  function stopTimer(): void {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function toggleFocusMode(): void {
    updateMode((current) => !current);
  }

  function startSessionFromTask(
    taskId: number,
    title: string,
    durationMinutes?: number
  ): void {
    const duration = durationMinutes ?? getDefaultDuration();
    const now = new Date();
    const endsAt = new Date(now.getTime() + duration * 60 * 1000);

    const session: FocusSession = {
      state: 'running',
      startedAt: now,
      endsAt,
      remainingMs: duration * 60 * 1000,
      source: 'task',
      sourceId: taskId,
      title,
    };

    set(session);
    saveToStorage(session);
    startTimer();
    setMode(true);
  }

  function startSessionFromBlock(
    blockId: string,
    title: string,
    start: Date,
    end: Date
  ): void {
    const now = new Date();
    const durationMs = end.getTime() - start.getTime();
    const endsAt = new Date(now.getTime() + durationMs);

    const session: FocusSession = {
      state: 'running',
      startedAt: now,
      endsAt,
      remainingMs: durationMs,
      source: 'block',
      sourceId: blockId,
      title,
    };

    set(session);
    saveToStorage(session);
    startTimer();
    setMode(true);
  }

  function pause(): void {
    update((session) => {
      if (session.state !== 'running') {
        return session;
      }

      stopTimer();
      const updated = {
        ...session,
        state: 'paused' as const,
      };
      saveToStorage(updated);
      return updated;
    });
  }

  function resume(): void {
    update((session) => {
      if (session.state !== 'paused') {
        return session;
      }

      if (!session.endsAt) {
        return session;
      }

      const now = Date.now();
      const remaining = session.endsAt.getTime() - now;

      if (remaining <= 0) {
        finish('timeup');
        return {
          ...session,
          state: 'idle',
          remainingMs: 0,
        };
      }

      const updated = {
        ...session,
        state: 'running' as const,
        remainingMs: remaining,
      };

      saveToStorage(updated);
      startTimer();
      return updated;
    });
  }

  async function finish(reason: 'completed' | 'canceled' | 'timeup'): Promise<void> {
    stopTimer();
    let notificationPayload: {
      title: string;
      body: string;
      data?: { source?: 'task' | 'block'; id?: number | string };
    } | null = null;

    update((session) => {
      if (session.state === 'idle') {
        return session;
      }

      const idleSession: FocusSession = {
        state: 'idle',
        startedAt: null,
        endsAt: null,
        remainingMs: 0,
        source: null,
        sourceId: null,
        title: '',
      };

      saveToStorage(null);

      if (reason === 'timeup') {
        notificationPayload = {
          title: 'Focus Session Complete',
          body: `Time's up for "${session.title}"`,
          data: {
            source: session.source || undefined,
            id: session.sourceId || undefined,
          },
        };
        toastStore.showSuccess('Focus session completed');
      } else if (reason === 'completed') {
        toastStore.showSuccess('Focus session completed');
      }

      return idleSession;
    });

    if (notificationPayload) {
      await notify(notificationPayload);
    }
  }

  if (initialSession && initialSession.state === 'running') {
    startTimer();
  } else if (initialSession && initialSession.state === 'paused') {
    const now = Date.now();
    if (initialSession.endsAt && initialSession.endsAt.getTime() > now) {
      initialSession.remainingMs = initialSession.endsAt.getTime() - now;
      set(initialSession);
    } else {
      const idleSession: FocusSession = {
        state: 'idle',
        startedAt: null,
        endsAt: null,
        remainingMs: 0,
        source: null,
        sourceId: null,
        title: '',
      };
      set(idleSession);
      saveToStorage(null);
    }
  }

  return {
    subscribe,
    focusModeEnabled: { subscribe: subscribeMode },
    session: { subscribe },
    toggleFocusMode,
    startSessionFromTask,
    startSessionFromBlock,
    pause,
    resume,
    finish,
  };
}

export const focusStore = createFocusStore();
