import { writable, get } from 'svelte/store';
import { settingsStore } from './settings';
import { notify } from '../lib/notifications/notificationAdapter';
import { toastStore } from './toastStore';
import { createFocusSession, completeFocusSession } from '../lib/api';
import { plannedEventsStore } from './plannedEventsStore';

export interface FocusSession {
  state: 'idle' | 'running' | 'paused';
  startedAt: Date | null;
  endsAt: Date | null;
  remainingMs: number;
  source: 'task' | 'block' | null;
  sourceId: number | string | null;
  title: string;
  taskId: number | null;
  plannedBlockId: number | null;
  backendSessionId: number | null;
}

const STORAGE_KEY = 'prism_focus_session';

function createIdleSession(): FocusSession {
  return {
    state: 'idle',
    startedAt: null,
    endsAt: null,
    remainingMs: 0,
    source: null,
    sourceId: null,
    title: '',
    taskId: null,
    plannedBlockId: null,
    backendSessionId: null,
  };
}

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
      taskId: parsed.taskId ?? (parsed.source === 'task' ? parsed.sourceId ?? null : null),
      plannedBlockId: parsed.plannedBlockId ?? (parsed.source === 'block' ? Number.parseInt(String(parsed.sourceId), 10) || null : null),
      backendSessionId: parsed.backendSessionId ?? null,
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
        taskId: session.taskId,
        plannedBlockId: session.plannedBlockId,
        backendSessionId: session.backendSessionId,
      })
    );
  } catch (err) {
    console.error('Failed to save focus session to storage', err);
  }
}

function parsePlannedBlockId(blockId: string): number | null {
  const parsed = Number.parseInt(blockId, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveBlockTaskId(blockId: string): number | null {
  const blocks = get(plannedEventsStore);
  const block = blocks.find((entry) => entry.id === blockId);
  return block?.taskId ?? null;
}

function createFocusStore() {
  const initialSession = loadFromStorage();
  const { subscribe, set, update } = writable<FocusSession>(initialSession || createIdleSession());
  const { subscribe: subscribeMode, set: setMode, update: updateMode } = writable<boolean>(false);

  let timerInterval: ReturnType<typeof setInterval> | null = null;
  const TICK_INTERVAL = 500;

  function getDefaultDuration(): number {
    const settings = get(settingsStore);
    return settings.productivity?.pomodoroFocus ?? 25;
  }

  function persistSessionStart(session: FocusSession): void {
    if (!session.startedAt) {
      return;
    }

    createFocusSession({
      taskId: session.taskId,
      plannedBlockId: session.plannedBlockId,
      startedAt: session.startedAt.toISOString(),
    }).then((record) => {
      update((current) => {
        if (
          current.state === 'idle' ||
          current.backendSessionId ||
          current.startedAt?.toISOString() !== session.startedAt?.toISOString() ||
          current.sourceId !== session.sourceId
        ) {
          return current;
        }

        const updated = {
          ...current,
          backendSessionId: record.id,
        };
        saveToStorage(updated);
        return updated;
      });
    }).catch((err) => {
      console.error('Failed to persist focus session start', err);
    });
  }

  function startTimer(): void {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
      update((session) => {
        if (session.state !== 'running' || !session.endsAt) {
          return session;
        }

        const remaining = session.endsAt.getTime() - Date.now();
        if (remaining <= 0) {
          finish('timeup');
          return createIdleSession();
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

  function startSessionFromTask(taskId: number, title: string, durationMinutes?: number): void {
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
      taskId,
      plannedBlockId: null,
      backendSessionId: null,
    };

    set(session);
    saveToStorage(session);
    startTimer();
    setMode(true);
    persistSessionStart(session);
  }

  function startSessionFromBlock(blockId: string, title: string, start: Date, end: Date): void {
    const now = new Date();
    const durationMs = Math.max(0, end.getTime() - start.getTime());
    const endsAt = new Date(now.getTime() + durationMs);
    const plannedBlockId = parsePlannedBlockId(blockId);
    const session: FocusSession = {
      state: 'running',
      startedAt: now,
      endsAt,
      remainingMs: durationMs,
      source: 'block',
      sourceId: blockId,
      title,
      taskId: resolveBlockTaskId(blockId),
      plannedBlockId,
      backendSessionId: null,
    };

    set(session);
    saveToStorage(session);
    startTimer();
    setMode(true);
    persistSessionStart(session);
  }

  function pause(): void {
    update((session) => {
      if (session.state !== 'running') {
        return session;
      }

      stopTimer();
      const remainingMs = session.endsAt ? Math.max(0, session.endsAt.getTime() - Date.now()) : session.remainingMs;
      const updated = {
        ...session,
        state: 'paused' as const,
        remainingMs,
        endsAt: null,
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

      const remainingMs = Math.max(0, session.remainingMs);
      if (remainingMs <= 0) {
        finish('timeup');
        return createIdleSession();
      }

      const updated = {
        ...session,
        state: 'running' as const,
        endsAt: new Date(Date.now() + remainingMs),
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
    let completedSession: FocusSession | null = null;

    update((session) => {
      if (session.state === 'idle') {
        return session;
      }

      completedSession = { ...session };
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

      return createIdleSession();
    });

    const sessionToPersist: any = completedSession;
    if (sessionToPersist && sessionToPersist.startedAt) {
      const endedAt = new Date();
      const durationMinutes = Math.max(
        0,
        Math.round((endedAt.getTime() - sessionToPersist.startedAt.getTime()) / 60000)
      );

      try {
        if (sessionToPersist.backendSessionId) {
          await completeFocusSession({
            id: sessionToPersist.backendSessionId,
            endedAt: endedAt.toISOString(),
            durationMinutes,
          });
        } else {
          const created = await createFocusSession({
            taskId: sessionToPersist.taskId,
            plannedBlockId: sessionToPersist.plannedBlockId,
            startedAt: sessionToPersist.startedAt.toISOString(),
          });
          await completeFocusSession({
            id: created.id,
            endedAt: endedAt.toISOString(),
            durationMinutes,
          });
        }
      } catch (err) {
        console.error('Failed to persist completed focus session', err);
      }
    }

    if (notificationPayload) {
      await notify(notificationPayload);
    }
  }

  if (initialSession && initialSession.state === 'running') {
    if (!initialSession.endsAt || initialSession.endsAt.getTime() <= Date.now()) {
      set(createIdleSession());
      saveToStorage(null);
    } else {
      startTimer();
      if (!initialSession.backendSessionId) {
        persistSessionStart(initialSession);
      }
    }
  } else if (initialSession && initialSession.state === 'paused') {
    set(initialSession);
    if (!initialSession.backendSessionId && initialSession.startedAt) {
      persistSessionStart(initialSession);
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


