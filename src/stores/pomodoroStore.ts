import { writable, get } from 'svelte/store';
import type { PomodoroSession, NewPomodoroSessionPayload } from '../lib/api';
import { logPomodoroSession, listPomodoroForDate } from '../lib/api';
import { normalizeDate } from '../lib/dates/safeDate';
import { settingsStore } from './settings';

export type PomodoroPhase = 'idle' | 'focus' | 'break';

export interface PomodoroState {
  phase: PomodoroPhase;
  remainingSeconds: number;
  totalSeconds: number;
  linkedTaskId?: number | null;
  running: boolean;
  startedAt?: Date | null;
}

function createPomodoroStore() {
  const { subscribe, set, update } = writable<PomodoroState>({
    phase: 'idle',
    remainingSeconds: 0,
    totalSeconds: 0,
    linkedTaskId: null,
    running: false,
    startedAt: null,
  });

  const todaySessions = writable<PomodoroSession[]>([]);

  function getDefaultFocusMinutes(): number {
    const settings = get(settingsStore);
    return settings.productivity?.pomodoroFocus ?? 25;
  }

  function getDefaultBreakMinutes(): number {
    const settings = get(settingsStore);
    return settings.productivity?.pomodoroBreak ?? 5;
  }

  function getAutoStartBreak(): boolean {
    const settings = get(settingsStore);
    return settings.productivity?.pomodoroAutoStart ?? true;
  }

  async function startFocus(taskId?: number | null) {
    const focusMinutes = getDefaultFocusMinutes();
    const totalSeconds = focusMinutes * 60;
    
    update((state) => ({
      phase: 'focus',
      remainingSeconds: totalSeconds,
      totalSeconds,
      linkedTaskId: taskId ?? state.linkedTaskId,
      running: true,
      startedAt: new Date(),
    }));
  }

  async function startBreak() {
    const breakMinutes = getDefaultBreakMinutes();
    const totalSeconds = breakMinutes * 60;
    
    update((state) => ({
      phase: 'break',
      remainingSeconds: totalSeconds,
      totalSeconds,
      linkedTaskId: state.linkedTaskId,
      running: true,
      startedAt: new Date(),
    }));
  }

  function stop() {
    update((state) => ({
      ...state,
      running: false,
    }));
  }

  function tick() {
    let completedState: PomodoroState | null = null;

    update((state) => {
      if (!state.running || state.remainingSeconds <= 0) {
        return state;
      }

      const newRemaining = state.remainingSeconds - 1;

      if (newRemaining <= 0) {
        // Capture state snapshot for async handling OUTSIDE the update callback
        completedState = { ...state };
        return {
          ...state,
          remainingSeconds: 0,
          running: false,
        };
      }

      return {
        ...state,
        remainingSeconds: newRemaining,
      };
    });

    // Trigger async session-complete work outside the synchronous update() callback
    // to avoid fire-and-forget inside a sync context
    if (completedState) {
      handleSessionComplete(completedState).catch((err) => {
        console.error('[pomodoroStore] Session complete handler failed', err);
      });
    }
  }

  async function handleSessionComplete(state: PomodoroState) {
    if (!state.startedAt) return;
    
    const durationMinutes = Math.floor((state.totalSeconds - state.remainingSeconds) / 60);
    const startedAt = state.startedAt.toISOString();
    const endedAt = new Date().toISOString();
    
    try {
      const payload: NewPomodoroSessionPayload = {
        taskId: state.linkedTaskId,
        kind: state.phase === 'focus' ? 'focus' : 'break',
        startedAt,
        endedAt,
        durationMinutes,
        completed: true,
      };
      
      await logPomodoroSession(payload);
      
      // Reload today's sessions
      await loadTodaySessions(new Date());
      
      // Auto-start break if it was a focus session and auto-start is enabled
      if (state.phase === 'focus' && getAutoStartBreak()) {
        // Reset linked task for break
        update((current) => ({
          ...current,
          phase: 'break',
          remainingSeconds: getDefaultBreakMinutes() * 60,
          totalSeconds: getDefaultBreakMinutes() * 60,
          running: true,
          startedAt: new Date(),
        }));
      } else {
        // Reset to idle
        set({
          phase: 'idle',
          remainingSeconds: 0,
          totalSeconds: 0,
          linkedTaskId: null,
          running: false,
          startedAt: null,
        });
      }
    } catch (err) {
      console.error('Failed to log pomodoro session', err);
    }
  }

  async function loadTodaySessions(date: Date) {
    try {
      const normalized = normalizeDate(date);
      const dateIso = normalized.toISOString().split('T')[0];
      const sessions = await listPomodoroForDate(dateIso);
      todaySessions.set(sessions);
    } catch (err) {
      console.error('Failed to load pomodoro sessions', err);
      todaySessions.set([]);
    }
  }

  function reset() {
    set({
      phase: 'idle',
      remainingSeconds: 0,
      totalSeconds: 0,
      linkedTaskId: null,
      running: false,
      startedAt: null,
    });
  }

  return {
    subscribe,
    todaySessions: { subscribe: todaySessions.subscribe },
    startFocus,
    startBreak,
    stop,
    tick,
    reset,
    loadTodaySessions,
  };
}

export const pomodoroStore = createPomodoroStore();

