<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pomodoroStore, type PomodoroState } from '../../stores/pomodoroStore';

  // Hoist to a top-level binding so Svelte's $store auto-subscription works
  const todaySessionsStore = pomodoroStore.todaySessions;
  import { tasksStore } from '../../stores/tasksStore';
  let todayTasks: any[] = [];
  let selectedTaskId: number | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  // Explicit type prevents Svelte from narrowing to the initial literal object shape
  let state: PomodoroState = $pomodoroStore;
  $: state = $pomodoroStore;
  $: todayTasks = $tasksStore || [];

  onMount(() => {
    // Load today's sessions
    pomodoroStore.loadTodaySessions(new Date());
    
    // Start tick interval
    timer = setInterval(() => {
      if (state.running) {
        pomodoroStore.tick();
      }
    }, 1000);
    
    return () => {
      if (timer) clearInterval(timer);
    };
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  function format(sec: number) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  }

  function getProgressPercent(): number {
    if (state.totalSeconds === 0) return 0;
    return ((state.totalSeconds - state.remainingSeconds) / state.totalSeconds) * 100;
  }

  async function handleStartFocus() {
    await pomodoroStore.startFocus(selectedTaskId);
  }

  async function handleStartBreak() {
    await pomodoroStore.startBreak();
  }

  function handleStop() {
    pomodoroStore.stop();
  }

  function handleReset() {
    pomodoroStore.reset();
    selectedTaskId = null;
  }

  // Count completed focus sessions today — use reactive store subscription
  $: todaySessionsList = $todaySessionsStore || [];
  $: completedFocusSessions = todaySessionsList.filter(
    (s: any) => s.kind === 'focus' && s.completed
  ).length;
</script>

<div class="pomodoro">
  <div class="header">
    <div>
      <p class="eyebrow">Pomodoro</p>
      <h4>
        {#if state.phase === 'idle'}
          Ready
        {:else if state.phase === 'focus'}
          Focus
        {:else}
          Break
        {/if}
      </h4>
    </div>
    {#if completedFocusSessions > 0}
      <div class="session-count">
        <span class="count-badge">{completedFocusSessions}</span>
        <span class="count-label">sessions today</span>
      </div>
    {/if}
  </div>

  <!-- Task Link Dropdown -->
  {#if state.phase === 'idle'}
    <div class="task-link">
      <label for="task-select">Link to task (optional):</label>
      <select id="task-select" bind:value={selectedTaskId} class="task-select">
        <option value={null}>None</option>
        {#each todayTasks.filter((t) => !t.done) as task}
          <option value={task.id}>{task.title}</option>
        {/each}
      </select>
    </div>
  {/if}

  <!-- Circular Progress -->
  <div class="timer-container">
    <svg class="progress-ring" viewBox="0 0 120 120">
      <circle
        class="progress-ring-background"
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke="var(--border)"
        stroke-width="8"
      />
      <circle
        class="progress-ring-progress"
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke="var(--accent)"
        stroke-width="8"
        stroke-dasharray={339.292}
        stroke-dashoffset={339.292 * (1 - getProgressPercent() / 100)}
        transform="rotate(-90 60 60)"
      />
    </svg>
    <div class="time-display">{format(state.remainingSeconds)}</div>
  </div>

  <!-- Phase Chip -->
  {#if state.phase !== 'idle'}
    <div class="phase-chip {state.phase}">
      {state.phase === 'focus' ? 'Focus' : 'Break'}
    </div>
  {/if}

  <!-- Controls -->
  <div class="controls">
    {#if state.phase === 'idle'}
      <button class="primary" on:click={handleStartFocus}>Start Focus</button>
      <button class="secondary" on:click={handleStartBreak}>Start Break</button>
    {:else}
      {#if state.running}
        <button class="primary" on:click={handleStop}>Pause</button>
      {:else}
        <button class="primary" on:click={state.phase === 'focus' ? handleStartFocus : handleStartBreak}>
          Resume
        </button>
      {/if}
      <button class="ghost" on:click={handleReset}>Reset</button>
    {/if}
  </div>
</div>

<style>
  .pomodoro {
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: var(--radius-md);
    background: var(--surface-1);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-xs);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  h4 {
    margin: 2px 0 0;
    font-size: 1rem;
    color: var(--text);
    font-weight: 600;
  }

  .session-count {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .count-badge {
    background: var(--accent);
    color: var(--bg);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .count-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .task-link {
    display: grid;
    gap: 6px;
  }

  .task-link label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .task-select {
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-0);
    color: var(--text);
    font-size: 0.85rem;
  }

  .task-select:focus {
    outline: 2px solid var(--accent);
    border-color: var(--accent);
  }

  .timer-container {
    position: relative;
    width: 200px;
    height: 200px;
    margin: 0 auto;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .progress-ring-background {
    opacity: 0.3;
  }

  .progress-ring-progress {
    transition: stroke-dashoffset 1s linear;
  }

  .time-display {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .phase-chip {
    display: inline-block;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 auto;
    width: fit-content;
  }

  .phase-chip.focus {
    background: var(--accent-light, var(--surface-0));
    color: var(--accent, var(--text));
    border: 1px solid var(--accent);
  }

  .phase-chip.break {
    background: var(--surface-0);
    color: var(--text);
    border: 1px solid var(--border);
  }

  .controls {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .primary,
  .secondary,
  .ghost {
    border-radius: var(--radius-sm);
    padding: 10px 16px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 150ms ease;
  }

  .primary {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  .primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .secondary {
    background: var(--surface-0);
    color: var(--text);
  }

  .secondary:hover {
    background: var(--surface-1);
  }

  .ghost {
    background: transparent;
    color: var(--text-muted);
    border-color: var(--border);
  }

  .ghost:hover {
    background: var(--surface-0);
    color: var(--text);
  }
</style>
