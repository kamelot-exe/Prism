import { writable } from 'svelte/store';

export type View = 'calendar' | 'settings' | 'insights';

const createUiStore = () => {
  const { subscribe, set } = writable<{ currentView: View }>({ currentView: 'calendar' });

  return {
    subscribe,
    setView: (view: View) => set({ currentView: view }),
    reset: () => set({ currentView: 'calendar' }),
  };
};

export const uiStore = createUiStore();
