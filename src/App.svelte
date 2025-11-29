<script lang="ts">
  import { Router, Link, Route } from 'svelte-routing';
  import MonthView from './components/views/MonthView.svelte';
  import WeekView from './components/views/WeekView.svelte';
  import DayView from './components/views/DayView.svelte';
  import Settings from './components/Settings.svelte';
  import { settingsStore } from './stores/settings';

  let currentPath = '/month';
  
  // Handle hash-based routing for Tauri
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.slice(1) || '/month';
    currentPath = hash.startsWith('/') ? hash : `/${hash}`;
  }
</script>

<Router url={currentPath}>
  <nav class="navbar">
    <div class="nav-brand">
      <h1>Prism Calendar</h1>
    </div>
    <div class="nav-links">
      <Link to="/month" class="nav-link">Month</Link>
      <Link to="/week" class="nav-link">Week</Link>
      <Link to="/day" class="nav-link">Day</Link>
      <Link to="/settings" class="nav-link">Settings</Link>
    </div>
  </nav>

  <main class="main-content">
    <Route path="/month" component={MonthView} />
    <Route path="/week" component={WeekView} />
    <Route path="/day" component={DayView} />
    <Route path="/settings" component={Settings} />
  </main>
</Router>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  .navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background-color: var(--bg-primary, #ffffff);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .nav-brand h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary, #111827);
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-link {
    text-decoration: none;
    color: var(--text-secondary, #6b7280);
    font-weight: 500;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .nav-link:hover {
    background-color: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .main-content {
    padding: 2rem;
    min-height: calc(100vh - 80px);
    background-color: var(--bg-secondary, #f9fafb);
  }
</style>

