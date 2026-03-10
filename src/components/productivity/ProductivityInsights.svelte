<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { tasksStore } from '../../stores/tasksStore';
  import { plannedEventsStore } from '../../stores/plannedEventsStore';
  import { pomodoroStore } from '../../stores/pomodoroStore';
  import {
    computeWeekAnalytics,
    weekStartFor,
    formatMinutes,
    rateLabel,
    efficiencyLabel,
    type WeekAnalytics,
  } from '../../lib/productivity/analyticsEngine';
  import { listPomodoroRange } from '../../lib/api';

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let weekOffset = 0; // 0 = this week, -1 = last week, …
  let analytics: WeekAnalytics | null = null;
  let loading = false;

  $: selectedWeekStart = (() => {
    const today = new Date();
    const ws = weekStartFor(today);
    ws.setDate(ws.getDate() + weekOffset * 7);
    return ws;
  })();

  $: selectedWeekLabel = (() => {
    const ws = selectedWeekStart;
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return weekOffset === 0
      ? `This week (${fmt(ws)} – ${fmt(we)})`
      : weekOffset === -1
      ? `Last week (${fmt(ws)} – ${fmt(we)})`
      : `${fmt(ws)} – ${fmt(we)}`;
  })();

  async function loadAnalytics() {
    loading = true;
    try {
      const tasks = get(tasksStore) ?? [];
      const blocks = get(plannedEventsStore) ?? [];

      // Load pomodoro sessions for the week range
      const ws = selectedWeekStart;
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      we.setHours(23, 59, 59, 999);

      let pomodoroSessions: any[] = [];
      try {
        pomodoroSessions = await listPomodoroRange(ws.toISOString(), we.toISOString());
      } catch {
        // Fallback: get today's sessions from store if range API unavailable
        const unsubTodaySessions = pomodoroStore.todaySessions.subscribe((s) => {
          pomodoroSessions = s;
        });
        unsubTodaySessions();
      }

      analytics = computeWeekAnalytics(
        selectedWeekStart,
        tasks,
        blocks,
        pomodoroSessions
      );
    } catch (err) {
      console.error('[ProductivityInsights] Failed to compute analytics', err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadAnalytics();
  });

  $: weekOffset, loadAnalytics();

  function barHeight(value: number, max: number): number {
    if (max === 0) return 0;
    return Math.min(100, Math.round((value / max) * 100));
  }

  function rateColor(rate: number): string {
    if (rate >= 90) return 'var(--accent, #10b981)';
    if (rate >= 70) return '#10b981';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
  }

  function prevWeek() { weekOffset -= 1; }
  function nextWeek() { if (weekOffset < 0) weekOffset += 1; }

  $: maxScheduled = analytics
    ? Math.max(...analytics.days.map((d) => d.scheduledMinutes), 1)
    : 1;
  $: maxFocus = analytics
    ? Math.max(...analytics.days.map((d) => d.actualFocusMinutes), 1)
    : 1;
</script>

<div class="insights">
  <!-- Header & week nav -->
  <div class="insights-header">
    <div>
      <p class="eyebrow">Productivity</p>
      <h3>Weekly Insights</h3>
      <p class="trust-note">Planned time comes from planner blocks. Actual time currently reflects tracked Pomodoro sessions, so linked focus work may be understated.</p>
    </div>
    <div class="week-nav">
      <button class="nav-btn" on:click={prevWeek} aria-label="Previous week">‹</button>
      <span class="week-label">{selectedWeekLabel}</span>
      <button
        class="nav-btn"
        on:click={nextWeek}
        disabled={weekOffset >= 0}
        aria-label="Next week"
      >›</button>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading analytics…</div>
  {:else if analytics}
    <!-- ── KPI row ── -->
    <div class="kpi-row">
      <div class="kpi-card">
        <span class="kpi-value" style="color:{rateColor(analytics.totals.completionRate)}">
          {analytics.totals.completionRate}%
        </span>
        <span class="kpi-label">Task completion</span>
        <span class="kpi-sub">{rateLabel(analytics.totals.completionRate)}</span>
        {#if analytics.completionRateDelta !== undefined}
          <span class="kpi-delta" class:pos={analytics.completionRateDelta >= 0} class:neg={analytics.completionRateDelta < 0}>
            {analytics.completionRateDelta >= 0 ? '+' : ''}{analytics.completionRateDelta}% vs last week
          </span>
        {/if}
      </div>

      <div class="kpi-card">
        <span class="kpi-value">{formatMinutes(analytics.totals.actualFocusMinutes)}</span>
        <span class="kpi-label">Focus time</span>
        <span class="kpi-sub">
          of {formatMinutes(analytics.totals.scheduledMinutes)} scheduled
        </span>
      </div>

      <div class="kpi-card">
        <span class="kpi-value">{analytics.totals.avgFocusEfficiency}%</span>
        <span class="kpi-label">Focus efficiency</span>
        <span class="kpi-sub">{efficiencyLabel(analytics.totals.avgFocusEfficiency / 100)}</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-value">{analytics.totals.completedTasks} / {analytics.totals.totalTasks}</span>
        <span class="kpi-label">Tasks done</span>
        {#if analytics.bestDay}
          <span class="kpi-sub">Best: {DAY_LABELS[analytics.days.indexOf(analytics.bestDay)]}</span>
        {/if}
      </div>
    </div>

    <!-- ── Daily bar chart: Scheduled vs Actual ── -->
    <div class="chart-section">
      <p class="chart-title">Scheduled vs Actual Focus (minutes)</p>
      <div class="bar-chart">
        {#each analytics.days as day, i}
          <div class="bar-col">
            <div class="bars">
              <div
                class="bar scheduled"
                style="height:{barHeight(day.scheduledMinutes, maxScheduled)}%"
                title="Scheduled: {formatMinutes(day.scheduledMinutes)}"
              ></div>
              <div
                class="bar actual"
                style="height:{barHeight(day.actualFocusMinutes, maxFocus)}%"
                title="Focus: {formatMinutes(day.actualFocusMinutes)}"
              ></div>
            </div>
            <span class="bar-label">{DAY_LABELS[i]}</span>
          </div>
        {/each}
      </div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot scheduled"></span>Scheduled</span>
        <span class="legend-item"><span class="legend-dot actual"></span>Focus tracked</span>
      </div>
    </div>

    <!-- ── Daily completion table ── -->
    <div class="table-section">
      <p class="chart-title">Daily Breakdown</p>
      <table class="day-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Tasks</th>
            <th>Done</th>
            <th>Planned</th>
            <th>Scheduled</th>
            <th>Focus</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {#each analytics.days as day, i}
            <tr class:today={day.date === new Date().toISOString().slice(0, 10)}>
              <td class="day-name">{DAY_LABELS[i]}</td>
              <td>{day.totalTasks || '–'}</td>
              <td>{day.completedTasks || '–'}</td>
              <td>{day.plannedMinutes > 0 ? formatMinutes(day.plannedMinutes) : '–'}</td>
              <td>{day.scheduledMinutes > 0 ? formatMinutes(day.scheduledMinutes) : '–'}</td>
              <td>{day.actualFocusMinutes > 0 ? formatMinutes(day.actualFocusMinutes) : '–'}</td>
              <td>
                {#if day.totalTasks > 0}
                  <span
                    class="rate-pill"
                    style="background:{rateColor(day.completionRate)}22; color:{rateColor(day.completionRate)}"
                  >
                    {day.completionRate}%
                  </span>
                {:else}
                  <span class="muted">–</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- ── Insight callouts ── -->
    {#if analytics.mostFocusedDay}
      <div class="callout">
        🎯 Your most focused day was
        <strong>{DAY_LABELS[analytics.days.indexOf(analytics.mostFocusedDay)]}</strong>
        with {formatMinutes(analytics.mostFocusedDay.actualFocusMinutes)} of tracked focus time.
      </div>
    {/if}
    {#if analytics.totals.scheduledMinutes > 0 && analytics.totals.actualFocusMinutes < analytics.totals.scheduledMinutes * 0.5}
      <div class="callout warn">
        ⚠ You only tracked {formatMinutes(analytics.totals.actualFocusMinutes)} of your
        {formatMinutes(analytics.totals.scheduledMinutes)} scheduled time. Try starting the Pomodoro
        timer when you begin a scheduled block.
      </div>
    {/if}
  {:else}
    <div class="empty-state">No data available for this week.</div>
  {/if}
</div>

<style>
  .insights {
    display: grid;
    gap: 18px;
    padding: 2px;
  }

  .insights-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .eyebrow {
    margin: 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  h3 {
    margin: 2px 0 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
  }

  .trust-note {
    margin: 6px 0 0;
    max-width: 44rem;
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .week-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .week-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .nav-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--surface-0);
  }

  .nav-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .loading, .empty-state {
    text-align: center;
    color: var(--text-muted);
    padding: 24px;
    font-size: 0.9rem;
  }

  /* ── KPI row ── */
  .kpi-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
  }

  .kpi-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 14px;
  }

  .kpi-value {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1.1;
  }

  .kpi-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .kpi-sub {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .kpi-delta {
    font-size: 0.78rem;
    margin-top: 2px;
  }

  .kpi-delta.pos { color: #10b981; }
  .kpi-delta.neg { color: #ef4444; }

  /* ── Bar chart ── */
  .chart-section, .table-section {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px;
    display: grid;
    gap: 12px;
  }

  .chart-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .bar-chart {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    height: 100px;
    align-items: flex-end;
  }

  .bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    gap: 4px;
  }

  .bars {
    display: flex;
    gap: 3px;
    align-items: flex-end;
    flex: 1;
    width: 100%;
    justify-content: center;
  }

  .bar {
    width: 10px;
    border-radius: 3px 3px 0 0;
    min-height: 3px;
    transition: height 300ms ease;
  }

  .bar.scheduled {
    background: var(--border);
  }

  .bar.actual {
    background: var(--accent, #3b82f6);
  }

  .bar-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-align: center;
  }

  .chart-legend {
    display: flex;
    gap: 16px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .legend-dot.scheduled {
    background: var(--border);
  }

  .legend-dot.actual {
    background: var(--accent, #3b82f6);
  }

  /* ── Table ── */
  .day-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .day-table th {
    text-align: left;
    padding: 6px 8px;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--border);
  }

  .day-table td {
    padding: 7px 8px;
    color: var(--text);
    border-bottom: 1px solid var(--border);
  }

  .day-table tr:last-child td {
    border-bottom: none;
  }

  .day-table tr.today td {
    background: var(--accent-light, rgba(59, 130, 246, 0.06));
  }

  .day-name {
    font-weight: 600;
  }

  .rate-pill {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 99px;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .muted {
    color: var(--text-muted);
  }

  /* ── Callouts ── */
  .callout {
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: var(--accent-light, rgba(59, 130, 246, 0.08));
    border: 1px solid var(--accent, #3b82f6);
    font-size: 0.875rem;
    color: var(--text);
    line-height: 1.5;
  }

  .callout.warn {
    background: rgba(245, 158, 11, 0.08);
    border-color: #f59e0b;
  }
</style>




