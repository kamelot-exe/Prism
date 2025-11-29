<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from './components/TopBar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import MonthView from './components/views/MonthView.svelte';
  import WeekView from './components/views/WeekView.svelte';
  import DayView from './components/views/DayView.svelte';
  import { settingsStore } from './stores/settings';

  let currentDate = new Date();
  let viewMode: 'day' | 'week' | 'month' = 'month';
  let searchQuery = '';

  onMount(async () => {
    // Apply initial theme
    await settingsStore.applyTheme($settingsStore.theme);
  });

  function handleNavigate(event: CustomEvent<{ direction: 'prev' | 'next' | 'today' }>) {
    const { direction } = event.detail;
    if (direction === 'today') {
      currentDate = new Date();
    } else if (direction === 'prev') {
      if (viewMode === 'month') {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      } else if (viewMode === 'week') {
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() - 7);
      } else {
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() - 1);
      }
    } else if (direction === 'next') {
      if (viewMode === 'month') {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      } else if (viewMode === 'week') {
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  }

  function handleViewChange(event: CustomEvent<'day' | 'week' | 'month'>) {
    viewMode = event.detail;
  }

  function handleSearch(event: CustomEvent<string>) {
    searchQuery = event.detail;
  }

  function handleDateSelect(event: CustomEvent<Date>) {
    currentDate = event.detail;
  }

  function handleThemeSelect(event: CustomEvent<'light' | 'dark' | 'glassmorphism' | 'avant-garde' | 'brutalism' | 'yeezy-minimal'>) {
    settingsStore.setTheme(event.detail);
  }
</script>

<div class="app">
  <TopBar
    {currentDate}
    {viewMode}
    on:navigate={handleNavigate}
    on:viewChange={handleViewChange}
    on:search={handleSearch}
  />

  <div class="app-body">
    <Sidebar
      on:dateSelect={handleDateSelect}
      on:themeSelect={handleThemeSelect}
    />

    <main class="main-area">
      {#if viewMode === 'month'}
        <MonthView {currentDate} {searchQuery} />
      {:else if viewMode === 'week'}
        <WeekView {currentDate} {searchQuery} />
      {:else}
        <DayView {currentDate} {searchQuery} />
      {/if}
    </main>
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--bg);
  }

  .app-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .main-area {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xl);
    background: var(--bg);
  }
</style>
