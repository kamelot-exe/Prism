# Prism Calendar — Architecture Audit
## PART 3: Scheduling Engine

This section covers recurrence, NLP task parsing, reminders, and the day-scheduling (time-blocking) subsystem.

---

## Recurrence

### Recurrence Logic — What Works

`domain/recurrence.rs` contains pure Rust recurrence expansion logic with unit tests for daily, weekly, and monthly patterns. This is the only tested domain logic in the codebase. The module is correctly isolated from database concerns and can be exercised independently.

### Issue — Recurrence Stored as Opaque JSON Blob (MEDIUM)

`tasks.recurrence` is a `TEXT` column containing serialised JSON. The `RecurrenceRule` struct is serialised to a string on write and deserialised on every read.

**Consequences:**
- Recurrence data cannot be filtered or indexed at the SQL level.
- Queries like "all recurring tasks this week" require loading every task and deserialising each recurrence object in Rust.
- The schema gives no indication of what fields a recurrence rule contains — a reader must know to parse the JSON and look at the `RecurrenceRule` struct definition.

**Recommended schema change:**
```sql
ALTER TABLE tasks ADD COLUMN recurrence_kind     TEXT;    -- 'daily' | 'weekly' | 'monthly' | 'yearly'
ALTER TABLE tasks ADD COLUMN recurrence_interval INTEGER; -- every N days/weeks/months
ALTER TABLE tasks ADD COLUMN recurrence_days     TEXT;    -- comma-separated day indices e.g. '1,3,5'
```

The JSON blob column can be retained as a migration bridge, but the structured columns allow SQL-level queries:
```sql
-- Impossible with JSON blob, trivial with structured columns:
SELECT * FROM tasks
WHERE recurrence_kind = 'weekly'
  AND date BETWEEN ? AND ?
```

### Issue — No Recurrence Exceptions in SQLite (MEDIUM)

The frontend contains logic for recurrence exceptions (editing or deleting a single instance of a recurring series), but there is no `recurrence_exceptions` table in SQLite. Exceptions are either lost on app restart or stored somewhere in localStorage.

**Proposed schema:**
```sql
CREATE TABLE recurrence_exceptions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    excluded_date TEXT NOT NULL,  -- ISO date of the skipped occurrence
    override_data TEXT            -- JSON, NULL = deleted; populated = rescheduled instance
);
```

Without this table, "edit this occurrence only" and "delete this occurrence only" cannot persist across restarts.

---

## NLP Task Parser

### Issue — Dual Parsers Will Diverge (HIGH)

Two separate NLP parsers implement the same natural language → task conversion logic:

| Location | Language | Used by |
|---|---|---|
| `src/lib/taskParser.ts` | TypeScript | `QuickAdd.svelte` pre-validation |
| `src-tauri/src/domain/task_parse.rs` | Rust | `task_parse_create` Tauri command |

`QuickAdd.svelte` calls `parseTextToTask()` (frontend) to show a live preview, then `task_parse_create` (Rust) re-parses the same input on submit. The two implementations parse the same string twice and will silently diverge as features are added to one but not the other.

**Recommended fix:**
- Remove or demote `taskParser.ts` to a non-authoritative UI hint (display only, not used for validation).
- All task creation flows (`QuickAdd`, `TodoPanel`, any future entry points) use `task_parse_create` exclusively for authoritative parsing.
- If a live preview is needed in the UI, add a lightweight `task_parse_preview` Tauri command that calls the same Rust parser and returns a preview DTO, keeping a single source of truth.

---

## Reminder Scheduling

### Issue — setTimeout Breaks After 24 Days (HIGH)

`reminderScheduler.ts` schedules event reminders using `setTimeout`. The JavaScript specification does not guarantee `setTimeout` beyond `2^31 - 1` milliseconds (~24.8 days). In practice, most runtimes treat values exceeding this as 0 and fire immediately.

Events created more than 24 days in advance — a normal user action for any meeting, birthday, or deadline — will silently not trigger their reminders. There is no error; the timer simply fires at the wrong time or not at all.

**Recommended fix:**
```typescript
const MAX_TIMEOUT_MS = 20 * 24 * 60 * 60 * 1000; // 20 days

function scheduleReminder(event: Event, reminderMs: number) {
    const delay = reminderMs - Date.now();
    if (delay > MAX_TIMEOUT_MS) {
        pendingReminders.set(event.id, { event, reminderMs });
        return; // will be promoted by the polling loop
    }
    const timer = setTimeout(() => fireReminder(event), delay);
    activeTimers.set(event.id, timer);
}

// Run every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [id, { event, reminderMs }] of pendingReminders) {
        if (reminderMs - now <= MAX_TIMEOUT_MS) {
            pendingReminders.delete(id);
            scheduleReminder(event, reminderMs);
        }
    }
}, 60_000);
```

---

## Day Scheduling (Time Blocking)

### Issue — PlannedEvents Stored in localStorage (HIGH)

The entire day-scheduler block store (`plannedEventsStore`) persists to `localStorage` under the key `prism_planned_events`. This means:

- User schedule data is invisible to the Rust backend.
- Planned blocks cannot be queried, exported, or backed up via any Tauri mechanism.
- localStorage can be cleared by OS-level browser storage management, permanently deleting schedule history.
- The `ProductivityInsights` analytics component cannot include planned-vs-actual comparisons.

**Proposed migration target — `planned_blocks` SQLite table:**
```sql
CREATE TABLE planned_blocks (
    id         TEXT PRIMARY KEY,     -- UUID
    task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    title      TEXT NOT NULL,
    start_ts   DATETIME NOT NULL,
    end_ts     DATETIME NOT NULL,
    color      TEXT,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_planned_blocks_start ON planned_blocks(start_ts);
```

The migration path: on first run after the update, read `localStorage['prism_planned_events']`, write entries to the new table, then clear the localStorage key.

---

## Summary

| Issue | Severity | File |
|---|---|---|
| Recurrence stored as JSON blob | Medium | `src-tauri/migrations/*.sql`, `tasks_repo.rs` |
| No recurrence exceptions table | Medium | Schema missing |
| Dual NLP parsers will diverge | High | `taskParser.ts`, `task_parse.rs` |
| setTimeout reminder limit | High | `reminderScheduler.ts` |
| PlannedEvents in localStorage | High | `plannedEventsStore.ts` |
