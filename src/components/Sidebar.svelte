<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { listCategories, listTasks, type Category, type Task } from '../lib/api';

  export let currentDate: Date;

  const dispatch = createEventDispatcher<{ dateSelect: Date }>();

  let categories: Category[] = [];
  let tasks: Task[] = [];

  onMount(async () => {
    categories = await listCategories().catch(() => []);
    tasks = await listTasks().catch(() => []);
  });

  const weeks = [0, 1, 2, 3, 4, 5];
  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function daysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function firstDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function selectDay(day: number) {
    const d = new Date(currentDate);
    d.setDate(day);
    dispatch('dateSelect', d);
  }
</script>

<aside class="sidebar">
  <section class="panel calendar">
    <div class="panel-header">
      <div>
        <p>Mini calendar</p>
        <strong>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
      </div>
    </div>
    <div class="weekday-row">
      {#each days as day}
        <span>{day}</span>
      {/each}
    </div>
    <div class="grid">
      {#each Array(firstDay(currentDate)).fill(null) as _}
        <div></div>
      {/each}
      {#each Array(daysInMonth(currentDate)) as _, index}
        <button
          class="day"
          class:today={index + 1 === new Date().getDate() && currentDate.getMonth() === new Date().getMonth()}
          on:click={() => selectDay(index + 1)}
        >
          {index + 1}
        </button>
      {/each}
    </div>
  </section>

  <section class="panel">
    <div class="panel-header">
      <p>Categories</p>
    </div>
    <div class="list">
      {#if categories.length === 0}
        <p class="muted">No categories yet</p>
      {:else}
        {#each categories as category}
          <div class="pill">
            <span class="dot" style={`background:${category.color_hex}`}></span>
            {category.name}
          </div>
        {/each}
      {/if}
    </div>
  </section>

  <section class="panel">
    <div class="panel-header">
      <p>Todos</p>
    </div>
    <div class="list">
      {#if tasks.length === 0}
        <p class="muted">No tasks yet</p>
      {:else}
        {#each tasks as task}
          <label class="task">
            <input type="checkbox" checked={task.done} disabled />
            <span>{task.title}</span>
          </label>
        {/each}
      {/if}
    </div>
  </section>
</aside>

<style>
  .sidebar {
    width: 320px;
    padding: 1rem;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    display: grid;
    gap: 1rem;
    overflow-y: auto;
  }
  .panel {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-lg);
    padding: 1rem;
    box-shadow: var(--shadow-xs);
  }
  .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  .panel-header p { margin: 0; color: var(--text-muted); }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.4rem; }
  .weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.35rem; }
  .weekday-row span { text-align: center; }
  .day { border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-secondary); color: var(--text); padding: 0.5rem; cursor: pointer; }
  .day.today { background: var(--accent-light); }
  .list { display: grid; gap: 0.35rem; }
  .pill { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.6rem; border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--text); border: 1px solid var(--border); }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .muted { color: var(--text-muted); margin: 0; }
  .task { display: flex; gap: 0.5rem; align-items: center; color: var(--text); }
</style>
