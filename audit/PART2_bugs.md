# Prism Calendar — Architecture Audit
## PART 2: Bugs & Risky Patterns

This section covers confirmed defects (wrong behaviour, data loss, panics) and patterns that are structurally risky regardless of whether a bug has triggered yet.

---

## Critical Bugs

### CRITICAL-1 — DB Pool Startup Race Condition (`main.rs`)

The `DbPool` is initialised inside `tauri::async_runtime::spawn()`. Tauri commands are registered and become callable before `manage()` completes. Any IPC call that arrives during the startup window panics with a missing `State<DbPool>` error.

**Current (unsafe):**
```rust
.setup(|app| {
    let h = app.handle().clone();
    async_runtime::spawn(async {
        if let Ok(db) = create_pool(&h).await {
            h.manage(db); // may be too late
        }
    });
    Ok(())
})
```

**Recommended:**
```rust
.setup(|app| {
    let db = async_runtime::block_on(
        create_pool(app.handle())
    ).expect("DB init failed");
    app.manage(db);
    Ok(())
})
```

Blocking on pool init in `setup()` ensures the pool is available before any command handler can be invoked. If the pool fails to init, the app exits with a clear error message rather than an unpredictable panic later.

---

### CRITICAL-2 — DB File Deleted on Migration Failure (`pool.rs`)

When a migration fails, `pool.rs` deletes `prism_calendar.db` and recreates an empty one. The intent is to recover from an old schema, but a single buggy migration in a future release will silently destroy a user's entire calendar history. No backup is made. No user confirmation is requested.

> **Risk:** A single bad migration in a future release will permanently delete all user data with no warning and no recovery path.

**Recommended recovery strategy:**
1. On migration failure, rename the DB to `prism_calendar_YYYYMMDD.bak`.
2. Emit an error event to the frontend via Tauri's event system.
3. Show the user an actionable error dialog with the backup path.
4. Abort startup rather than silently wiping data.

---

### CRITICAL-3 — Events Range Query Misses Spanning Events (`events_repo.rs`)

The events query uses `WHERE start_ts >= ? AND end_ts <= ?`. Multi-day events whose start is before the queried range but whose end falls inside it are never returned. A week view query for Dec 1–7 will not show an event running Nov 30–Dec 2.

**Current (buggy):**
```sql
WHERE start_ts >= ?   -- range_start
  AND end_ts   <= ?   -- range_end
-- Misses: event starting Nov 30, ending Dec 2
-- when range is Dec 1–7
```

**Correct (overlap test):**
```sql
WHERE start_ts < ?    -- range_end
  AND end_ts   > ?    -- range_start
-- Any event touching the range is included
```

This is a silent bug — no error is thrown, events just disappear from views. It affects all multi-day events and any event that spans a view boundary.

---

### CRITICAL-4 — SQLite WAL Mode Not Enabled

The database opens in default journal mode (`DELETE`). On concurrent read+write (two store updates firing simultaneously), SQLite serialises all operations. With a 10-connection pool and no WAL mode, the pool provides no actual concurrency benefit. WAL mode also ensures `PRAGMA foreign_keys=ON` is respected correctly.

**Fix — add to `pool.rs` immediately after pool creation:**
```rust
sqlx::query("PRAGMA journal_mode=WAL;").execute(&pool).await?;
sqlx::query("PRAGMA synchronous=NORMAL;").execute(&pool).await?;
sqlx::query("PRAGMA foreign_keys=ON;").execute(&pool).await?;
```

> Note: `foreign_keys` is `OFF` by default in SQLite. `ON DELETE SET NULL` on `category_id` and `task_id` is silently ignored without this pragma.

---

## High-Severity Issues

### HIGH-1 — safeInvoke Swallows Rust Error Messages

`safeInvoke()` catches all errors and returns `null`. `invokeOrThrow()` converts `null` to a generic `Error("Invoke X failed")`. The original `AppError` message from Rust — which contains the specific database error or validation reason — is lost. Stores show a generic toast; developers see nothing actionable in the logs.

The `AppError` type already implements `Serialize` correctly. The fix is to propagate the structured error object through the TypeScript layer instead of discarding it.

---

### HIGH-2 — gmail_wait_for_callback Blocks Indefinitely

The Gmail OAuth flow starts an `axum` HTTP server to receive the OAuth callback. If the user opens the auth URL but never completes the flow (closes the browser, is interrupted), `gmail_wait_for_callback` will block indefinitely on its `oneshot` receiver.

A configurable timeout (e.g. 5 minutes) must be added to the callback listener, after which the server shuts down and an appropriate error is returned to the frontend.

This is also a dependency-hygiene issue: `axum`, `tower`, `tower-http`, `reqwest`, and `oauth2` represent approximately 60% of binary size for a single optional integration that can be replaced with `tauri-plugin-oauth`. See Part 7.

---

### HIGH-3 — setTimeout Reminders Break After 24 Days

`reminderScheduler.ts` schedules reminders with `setTimeout`. The reliable maximum for `setTimeout` is ~2³¹ ms (~24.8 days). Events created more than 24 days in advance will silently not trigger their reminders.

**Fix:** Events more than 20 days out go into a `pendingReminders` list. A `setInterval` (every 60 s) checks the list and promotes entries to `setTimeout` when they come within 20 days.

---

### HIGH-4 — Dual NLP Task Parsers Will Diverge

`taskParser.ts` (frontend) and `task_parse.rs` (Rust) both implement natural language task parsing. `QuickAdd.svelte` calls the frontend parser to pre-validate, then `task_parse_create` re-parses in Rust. The two implementations parse the same input string twice with different logic and will silently diverge as features are added.

The frontend parser should be removed or demoted to a non-authoritative UI hint only. All task creation flows should use `task_parse_create` exclusively for authoritative parsing.

---

## Tech Debt — Vestigial Code

These items do not cause runtime bugs today but add noise, confusion, and maintenance cost.

| Item | Location | Issue |
|---|---|---|
| `suggestions_stub` registered command | `main.rs` | Returns `Vec<String>` empty. Every call crosses IPC for zero value. Remove until the suggestions feature is built. |
| Two migrations directories | `/migrations/` (root) and `src-tauri/migrations/` | sqlx only reads `src-tauri/migrations/`. The root directory is a legacy artifact causing confusion about which migrations are active. |
| `landing_page.jsx` in project root | `/landing_page.jsx` | A React JSX file unrelated to the Tauri app. Not part of the Vite build. Delete or move to a separate repo. |
| `finish()` in focusStore fires async inside `update()` | `src/lib/focusStore.ts` | `focusStore.finish()` calls `notify()` (Tauri notification command) inside the synchronous `writable.update()` callback — the same fire-and-forget anti-pattern fixed in `pomodoroStore` during the RC pass. Move `notify()` to after the `update()` call returns. |
