import App from './App.svelte';
import './styles/main.css';
import { settingsStore } from './stores/settings';
import { eventsStore } from './stores/eventsStore';
import { tasksStore } from './stores/tasksStore';

const mountTarget = document.getElementById('app');

if (!mountTarget) {
  throw new Error('Prism Calendar root element #app not found; UI cannot mount.');
}

// Ensure stores are ready before any child component consumes them.
settingsStore.init();

const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

eventsStore.loadRange(monthStart, monthEnd).catch((err) => {
  if ((import.meta as any).env?.PROD) console.error('Failed to preload events', err);
});

tasksStore.loadAll().catch((err) => {
  if ((import.meta as any).env?.PROD) console.error('Failed to preload tasks', err);
});

const app = new App({
  target: mountTarget,
});

export default app;
