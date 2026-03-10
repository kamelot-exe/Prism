import { writable } from 'svelte/store';

export interface NavigationAction {
  type: 'date' | 'task' | 'event' | 'block';
  target: Date | number | string;
  timestamp: number;
}

function createUiNavigationStore() {
  const { subscribe, set } = writable<NavigationAction | null>(null);

  function goToDate(date: Date): void {
    set({
      type: 'date',
      target: date,
      timestamp: Date.now(),
    });
  }

  function focusTask(taskId: number): void {
    set({
      type: 'task',
      target: taskId,
      timestamp: Date.now(),
    });
  }

  function focusEvent(eventId: number): void {
    set({
      type: 'event',
      target: eventId,
      timestamp: Date.now(),
    });
  }

  function focusBlock(blockId: string): void {
    set({
      type: 'block',
      target: blockId,
      timestamp: Date.now(),
    });
  }

  return {
    subscribe,
    goToDate,
    focusTask,
    focusEvent,
    focusBlock,
  };
}

export const uiNavigationStore = createUiNavigationStore();

