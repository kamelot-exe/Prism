# Prism Calendar — Architecture Audit
## PART 4: Data Layer

This section covers the SQLite schema, migration strategy, repository pattern, and all data that currently lives outside the database.

---

## SQLite Schema — Current State

The schema is managed by `sqlx` versioned migrations in `src-tauri/migrations/`. Migrations run automatically on pool init via `sqlx::migrate!()`.

### Core Tables

| Table | Purpose | Notes |
|---|---|---|
| `events` | Calendar events | `start_ts`, `end_ts` as DATETIME; `category_id` FK with ON DELETE SET NULL |
| `tasks` | To-do items with optional date | `recurrence` as TEXT JSON blob (see below) |
| `categories` | Event/task categories | `is_hidden` column never used in SQL |
| `pomodoro_sessions` | Completed Pomodoro timer sessions | Links to `task_id` (nullable) and `category_id` (nullable) |
| `settings` | Key-value app settings | Nested objects serialised to JSON in `value` field |

### Data Outside SQLite

Two significant user-facing features persist to `localStorage` instead of SQLite:

| Data | Current Storage | Risk |
|---|---|---|
| Day scheduler blocks (`plannedEventsStore`) | `localStorage['prism_planned_events']` | Lost on storage clear; invisible to backend |
| Active/completed focus sessions (`focusStore`) | `localStorage['prism_focus_*']` | Analytics blind spot; no history |

---

## Migration Strategy

### Issue — DB File Deleted on Migration Failure (CRITICAL)

`pool.rs` contains the following recovery logic:

```rust
if let Err(e) = sqlx::migrate!().run(&pool).await {
    // Drop the pool
    drop(pool);
    // Delete the database file
    std::fs::remove_file(&db_path)?;
    // Recreate empty
    return create_pool_at(db_path).await;
}
```

The intent is to recover from a corrupted or incompatible old schema. In practice, a single buggy `ALTER TABLE` statement in a future migration will silently delete every user's calendar, contact list, and Pomodoro history with no warning and no recovery path.

**Correct strategy:**
```rust
if let Err(e) = sqlx::migrate!().run(&pool).await {
    drop(pool);
    // Back up, don't delete
    let backup = db_path.with_extension("bak");
    std::fs::rename(&db_path, &backup)?;
    // Notify the frontend
    app_handle.emit("migration-failed", MigrationError {
        message: e.to_string(),
        backup_path: backup.to_string_lossy().into_owned(),
    })?;
    // Abort — do not continue with an empty database
    return Err(AppError::MigrationFailed(e.to_string()));
}
```

### Issue — Two Migrations Directories

There is both a `/migrations/` directory at the project root and `src-tauri/migrations/` where `sqlx` actually looks. The root directory appears to be a legacy artifact from an earlier project structure. It should be deleted to avoid confusion about which migrations are active.

### Issue — Settings Schema Has No Migration Path (MEDIUM)

Settings are stored as flat key-value pairs in the `settings` table. `ProductivitySettings` (including `goals`, `weeklyPlan`, `weeklyCarry`) is serialised as a JSON blob in a single `value` field. There is no version field on settings rows and no migration strategy for evolving the shape of nested settings objects.

If a future release adds or renames a key inside `ProductivitySettings`, old installations will silently have the wrong shape deserialized. A `schema_version` field on the settings table (or a dedicated `settings_v2` migration) should be planned.

---

## Repository Pattern

### What Is Working Well

All SQL is isolated in `src-tauri/src/db/repositories/`. Each domain has its own file (`events_repo.rs`, `tasks_repo.rs`, `categories_repo.rs`, `pomodoro_repo.rs`). Command handlers in `src-tauri/src/api/` call repository functions and return domain types — they contain zero SQL. This boundary is correctly applied throughout the codebase.

### Issue — update_task / update_event Use 2 Queries (MEDIUM)

Both `update_task` and `update_event` issue a `SELECT` to load the existing record, merge fields in Rust, then issue an `UPDATE`. This pattern exists because partial updates (only the changed fields) need a base to merge onto.

SQLite supports `UPDATE … SET col = COALESCE(?, col) RETURNING *` which accomplishes the same in one round-trip and removes the read-modify-write race:

```sql
UPDATE events
SET
    title      = COALESCE(?, title),
    start_ts   = COALESCE(?, start_ts),
    end_ts     = COALESCE(?, end_ts),
    category_id = COALESCE(?, category_id)
WHERE id = ?
RETURNING *
```

### Issue — map_bool() Is Unnecessary

`events_repo.rs` contains:
```rust
fn map_bool(value: bool) -> i32 {
    if value { 1 } else { 0 }
}
```

`sqlx` 0.7 binds `bool` directly to SQLite `INTEGER`. This helper is dead code and can be removed.

---

## Schema Recommendations

### Proposed: planned_blocks

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

### Proposed: focus_sessions

A `focus_sessions` table with the same schema as `pomodoro_sessions` (minus the `kind` column) would capture completed focus sessions for analytics without relying on localStorage:

```sql
CREATE TABLE focus_sessions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    started_at   DATETIME NOT NULL,
    ended_at     DATETIME NOT NULL,
    duration_min INTEGER NOT NULL,
    notes        TEXT
);
```

### Proposed: recurrence_exceptions

```sql
CREATE TABLE recurrence_exceptions (
    id            INTEGER PRIMARY KEY,
    task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    excluded_date TEXT NOT NULL,  -- ISO date 'YYYY-MM-DD'
    override_data TEXT            -- NULL = deleted occurrence; JSON = rescheduled
);
```

### Proposed: Structured Recurrence Columns

```sql
ALTER TABLE tasks ADD COLUMN recurrence_kind     TEXT;
ALTER TABLE tasks ADD COLUMN recurrence_interval INTEGER;
ALTER TABLE tasks ADD COLUMN recurrence_days     TEXT;  -- comma-separated e.g. '1,3,5'
```

---

## Current vs Target Schema Summary

| Data | Current Storage | Target | Priority |
|---|---|---|---|
| Day Scheduler Blocks | `localStorage` | SQLite `planned_blocks` | Near-term |
| Active Focus Session | `localStorage` | SQLite `focus_sessions` | Near-term |
| Recurrence Rules | JSON blob in `tasks.recurrence` | Structured columns in `tasks` | Long-term |
| Recurrence Exceptions | Not persisted | SQLite `recurrence_exceptions` | Long-term |
| Category Visibility | In-memory `Set<number>` | Remove `categories.is_hidden` or use it | Medium |
| Settings (nested objects) | JSON values in key-value table | Versioned settings schema | Low |

---

## WAL Mode

SQLite WAL mode is not enabled. The database opens in default journal mode (`DELETE`). Add the following pragmas immediately after pool creation in `pool.rs`:

```rust
sqlx::query("PRAGMA journal_mode=WAL;").execute(&pool).await?;
sqlx::query("PRAGMA synchronous=NORMAL;").execute(&pool).await?;
sqlx::query("PRAGMA foreign_keys=ON;").execute(&pool).await?;
```

**Impact:**
- WAL mode allows concurrent reads during a write, which the 10-connection pool currently cannot exploit.
- `PRAGMA foreign_keys=ON` enforces `ON DELETE SET NULL` constraints that are currently silently ignored.
- `PRAGMA synchronous=NORMAL` provides a safe write-durability trade-off for a desktop app (full `FULL` mode is not necessary for local-only data).
