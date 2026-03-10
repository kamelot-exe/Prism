<script lang="ts">
  import { get } from 'svelte/store';
  import { getEvents, listTasks } from '../../lib/api';
  import type { Event, Task } from '../../lib/api';
  import { categoryStore } from '../../stores/categoryStore';
  import { toastStore } from '../../stores/toastStore';
  import { downloadIcs, exportToIcs } from '../../lib/export/icsExport';
  import { eventsToCSV, tasksToCSV, downloadCSV } from '../../lib/export/csvExport';

  type ExportRange = 'all' | '30d' | '90d' | '1y';

  let exportRange: ExportRange = 'all';
  let isExporting = false;

  function getDateFilter(range: ExportRange): { start?: Date; end?: Date } {
    if (range === 'all') return {};
    const now = new Date();
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return { start };
  }

  async function getEventsForExport(range: ExportRange): Promise<Event[]> {
    const all = await getEvents();
    const { start } = getDateFilter(range);
    if (!start) return all;
    return all.filter((e) => new Date(e.start_time) >= start);
  }

  async function getTasksForExport(): Promise<Task[]> {
    return await listTasks();
  }

  async function handleIcsExport() {
    isExporting = true;
    try {
      const events = await getEventsForExport(exportRange);
      const categories = get(categoryStore);
      if (events.length === 0) {
        toastStore.showError('No events to export for the selected range');
        return;
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadIcs(events, categories, `prism-calendar-${dateStr}.ics`);
      toastStore.showSuccess(`Exported ${events.length} events as ICS`);
    } catch (err) {
      console.error('[ExportPanel] ICS export failed', err);
      toastStore.showError('Export failed. Please try again.');
    } finally {
      isExporting = false;
    }
  }

  async function handleEventsCSVExport() {
    isExporting = true;
    try {
      const events = await getEventsForExport(exportRange);
      const categories = get(categoryStore);
      if (events.length === 0) {
        toastStore.showError('No events to export for the selected range');
        return;
      }
      const csv = eventsToCSV(events, categories);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `prism-events-${dateStr}.csv`);
      toastStore.showSuccess(`Exported ${events.length} events as CSV`);
    } catch (err) {
      console.error('[ExportPanel] CSV export failed', err);
      toastStore.showError('Export failed. Please try again.');
    } finally {
      isExporting = false;
    }
  }

  async function handleTasksCSVExport() {
    isExporting = true;
    try {
      const tasks = await getTasksForExport();
      if (tasks.length === 0) {
        toastStore.showError('No tasks to export');
        return;
      }
      const csv = tasksToCSV(tasks);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `prism-tasks-${dateStr}.csv`);
      toastStore.showSuccess(`Exported ${tasks.length} tasks as CSV`);
    } catch (err) {
      console.error('[ExportPanel] Tasks CSV export failed', err);
      toastStore.showError('Export failed. Please try again.');
    } finally {
      isExporting = false;
    }
  }

  async function handleIcsCopy() {
    isExporting = true;
    try {
      const events = await getEventsForExport(exportRange);
      if (events.length === 0) {
        toastStore.showError('No events to export for the selected range');
        return;
      }
      const categories = get(categoryStore);
      const ics = exportToIcs(events, categories);
      await navigator.clipboard.writeText(ics);
      toastStore.showSuccess('ICS content copied to clipboard');
    } catch {
      toastStore.showError('Could not copy to clipboard');
    } finally {
      isExporting = false;
    }
  }
</script>

<section class="export-panel">
  <div class="section-header">
    <div>
      <h3>Export & Backup</h3>
      <p class="subtitle">Download your calendar data in standard formats</p>
    </div>
  </div>

  <div class="field">
    <label for="export-range">Date range</label>
    <select id="export-range" bind:value={exportRange}>
      <option value="all">All time</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
      <option value="1y">Last year</option>
    </select>
  </div>

  <div class="export-grid">
    <div class="export-card">
      <div class="export-icon">Calendar</div>
      <div class="export-info">
        <span class="export-title">iCalendar (.ics)</span>
        <span class="export-desc">
          Standard format compatible with Google Calendar, Apple Calendar, and Outlook
        </span>
      </div>
      <div class="export-actions">
        <button
          class="btn-export"
          disabled={isExporting}
          on:click={handleIcsExport}
          aria-busy={isExporting}
        >
          Download .ics
        </button>
        <button
          class="btn-ghost-sm"
          disabled={isExporting}
          on:click={handleIcsCopy}
          title="Copy ICS to clipboard"
        >
          Copy
        </button>
      </div>
    </div>

    <div class="export-card">
      <div class="export-icon">CSV</div>
      <div class="export-info">
        <span class="export-title">Events CSV</span>
        <span class="export-desc">
          Spreadsheet-friendly format for Excel, Numbers, and Google Sheets
        </span>
      </div>
      <div class="export-actions">
        <button
          class="btn-export"
          disabled={isExporting}
          on:click={handleEventsCSVExport}
          aria-busy={isExporting}
        >
          Download .csv
        </button>
      </div>
    </div>

    <div class="export-card">
      <div class="export-icon">Tasks</div>
      <div class="export-info">
        <span class="export-title">Tasks CSV</span>
        <span class="export-desc">
          All your tasks including priority, recurrence, and completion status
        </span>
      </div>
      <div class="export-actions">
        <button
          class="btn-export"
          disabled={isExporting}
          on:click={handleTasksCSVExport}
          aria-busy={isExporting}
        >
          Download .csv
        </button>
      </div>
    </div>
  </div>

  <p class="export-note">
    Exports are generated locally in your browser. No data is sent to any server.
  </p>
</section>

<style>
  .export-panel {
    display: grid;
    gap: 16px;
  }

  .section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
  }

  .subtitle {
    margin: 2px 0 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .field {
    display: grid;
    gap: 6px;
    max-width: 260px;
  }

  .field label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  select {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    font-size: 0.95rem;
  }

  .export-grid {
    display: grid;
    gap: 10px;
  }

  .export-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .export-icon {
    font-size: 0.9rem;
    font-weight: 700;
    flex-shrink: 0;
    width: 56px;
    text-align: center;
    color: var(--text-muted);
  }

  .export-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .export-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text);
  }

  .export-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .export-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-export {
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: white;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    transition: opacity 150ms ease, transform 150ms ease;
  }

  .btn-export:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-export:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-ghost-sm {
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-0);
    color: var(--text);
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 150ms;
  }

  .btn-ghost-sm:hover:not(:disabled) {
    background: var(--surface-1);
  }

  .btn-ghost-sm:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .export-note {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-muted);
    padding: 8px 12px;
    background: var(--surface-0);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }
</style>
