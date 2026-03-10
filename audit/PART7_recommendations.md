# Prism Calendar — Architecture Audit
## PART 7: Recommendations

All recommendations are pragmatic improvements. No rewrite is proposed. The Tauri + Svelte + SQLite stack is well-suited to a local-first desktop calendar and does not need to change fundamentally.

---

## Immediate — Before Next Release

These items pose data integrity or stability risks and must be resolved before shipping to users.

| # | Change | Where / How |
|---|---|---|
| 1 | **Block on DB pool init** | `main.rs setup()`: use `async_runtime::block_on(create_pool())` and call `app.manage()` before returning `Ok(())`. Eliminates the startup race that can panic any command called before pool init completes. |
| 2 | **Replace DB-delete with graceful failure** | `pool.rs`: on migration failure, rename DB to `.bak`, emit a `migration-failed` event to the frontend via Tauri's event system, then abort startup. Never silently delete user data. |
| 3 | **Fix events range query** | `events_repo.rs`: change `WHERE start_ts >= ? AND end_ts <= ?` to `WHERE start_ts < ? AND end_ts > ?` (pass `range_end`, `range_start` in that order). Multi-day events will appear correctly in all views. |
| 4 | **Enable SQLite WAL mode** | `pool.rs` after `connect()`: add `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=NORMAL`, `PRAGMA foreign_keys=ON`. Enables concurrent reads, enforces FK constraints, significant write-performance benefit. |
| 5 | **Remove dead dependencies and vestigial files** | `package.json`: remove `svelte-routing`. `main.rs`: remove `suggestions_stub` from `invoke_handler!`. Delete `/migrations/` root directory. Delete `landing_page.jsx`. |
| 6 | **Fix focusStore async in update()** | `src/lib/focusStore.ts finish()`: capture a `shouldNotify` flag inside `writable.update()`, then call `notify()` after the callback returns. Same pattern applied to `pomodoroStore` during the RC pass. |

---

## Near-Term — Next Development Cycle

These items reduce maintenance burden, resolve data persistence gaps, and clean up the IPC layer.

| # | Change | Where / How |
|---|---|---|
| 7 | **Add `#[serde(rename)]` to Rust types** | `domain/events.rs`, `domain/tasks.rs`: rename `start_ts` → `startTime`, `is_focus` → `isFocus`, etc. with serde attributes. Delete `mapEventToApi()`, `mapEventFromApi()`, and all equivalent mapping functions from `api.ts`. |
| 8 | **Add `planned_blocks` table to SQLite** | New migration + `planned_blocks_repo.rs` + Tauri commands. On first run after upgrade, migrate data from `localStorage['prism_planned_events']` to the new table. Remove all `localStorage` usage from `plannedEventsStore`. |
| 9 | **Add `focus_sessions` table to SQLite** | New migration + `focus_sessions_repo.rs`. `focusStore.finish()` writes the completed session to the DB. `ProductivityInsights` can then query focus session history alongside Pomodoro history. |
| 10 | **Fix reminder setTimeout limit** | `reminderScheduler.ts`: events more than 20 days out go into a `pendingReminders` map. A `setInterval` (every 60 s) promotes entries to `setTimeout` when they fall within the 20-day window. Prevents silent reminder misfire for distant events. |
| 11 | **Split `api.ts` into per-domain modules** | Create `src/lib/api/{events,tasks,categories,pomodoro,settings,mocks,types}.ts`. Update all import sites. Each module owns its own type definitions, mapping functions, and command wrappers. |
| 12 | **Remove duplicate NLP parser** | `taskParser.ts`: delete or demote to non-authoritative UI preview only. All task creation flows (`QuickAdd`, `TodoPanel`) use `task_parse_create` exclusively. Optionally add `task_parse_preview` Tauri command for live preview with single source of truth. |
| 13 | **Add tasks_list pagination / date-range default** | `tasks_repo.rs`: add `date_from`/`date_to` optional parameters. Default to ±6 months from today if no date is specified. Remove the unbounded `SELECT * FROM tasks` path. Provide `tasks_export_all` for export use cases. |

---

## Long-Term — Planned Improvements

These items require more design work or cross-cutting refactors but will significantly improve scalability and maintainability.

| # | Change | Notes |
|---|---|---|
| 14 | **Replace axum + oauth2 + reqwest with tauri-plugin-oauth** | Eliminates ~5 crates (~60% of binary size). The plugin uses Tauri's deep link handler for the OAuth callback. Significantly reduces binary size and compile time. Resolves the unbounded `gmail_wait_for_callback` blocking issue as a side effect. |
| 15 | **Normalize recurrence to structured columns** | Add `recurrence_kind`, `recurrence_interval`, `recurrence_days TEXT` columns to `tasks`. Keep the JSON blob column for backward compatibility. Enables SQL-level recurrence queries, indexing, and `WHERE recurrence_kind = 'weekly'` filters. |
| 16 | **Add `recurrence_exceptions` table** | Schema: `(id, task_id, excluded_date TEXT, override_data TEXT)`. Required for correct "edit one instance" and "delete one instance" semantics on recurring items. Currently these changes cannot survive an app restart. |
| 17 | **Plan Svelte 5 runes migration** | Svelte 5 is released and stable. The runes model maps cleanly onto existing `writable`/`derived` store patterns. Start with leaf components (`Pomodoro`, `ToastContainer`, `CategoryTag`) and work inward. Do not rush — Svelte 4 remains supported. |
| 18 | **Add a test layer** | Rust: unit tests for `domain/task_parse.rs` and all repository functions via `sqlx` test macros with in-memory SQLite (`#[sqlx::test]`). Frontend: vitest for stores and `autoScheduler.ts`. `domain/recurrence.rs` already has unit tests — use it as the pattern. |
| 19 | **Add eventsStore LRU eviction** | Cap the event `Map` at ~2,000 entries. Evict entries outside ±6 months from the current view on each `loadRange` call to bound memory usage for long-term users. Replace the linear `Array.from(cache.values()).filter()` scan with a sorted structure. |

---

## Dependency Health

| Dependency | Version | Status | Action |
|---|---|---|---|
| `tauri` | 2.9.3 | Current, stable | Keep |
| `svelte` | 4.2.7 | Supported; Svelte 5 available | Plan migration (#17) |
| `sqlx` | 0.7 | One major version behind (0.8 current) | Upgrade |
| `reqwest` | 0.11 | Legacy series (0.12 available) | Replace with `tauri-plugin-oauth` (#14) |
| `axum` | 0.7 | Only used for OAuth callback | Remove (#14) |
| `tower` / `tower-http` | 0.4 / 0.5 | Only used as axum middleware | Remove (#14) |
| `keyring` | 2.3 | Stable; Linux needs `secret-service` | Keep; document Linux requirement |
| `svelte-routing` | 1.11.0 | Unused in the application | Remove (#5) |

---

## Priority Matrix

```
IMMEDIATE (before release)     NEAR-TERM (next cycle)     LONG-TERM (planned)
─────────────────────────────  ──────────────────────────  ────────────────────────
#1  Block DB pool init         #7  serde rename            #14 Replace OAuth deps
#2  Safe migration recovery    #8  planned_blocks SQLite   #15 Normalize recurrence
#3  Fix range query            #9  focus_sessions SQLite   #16 Recurrence exceptions
#4  Enable WAL mode            #10 Fix reminder setTimeout #17 Svelte 5 migration
#5  Remove dead deps           #11 Split api.ts            #18 Test layer
#6  Fix focusStore async       #12 Remove duplicate NLP    #19 eventsStore LRU
                               #13 Paginate tasks_list
```

---

## What Not to Change

The following patterns are well-designed and should be preserved:

- **Repository pattern in Rust** — zero SQL in command handlers; keep this boundary.
- **sqlx prepared statements** — SQL injection is structurally impossible; never introduce string-concatenated queries.
- **AppError as Serialize** — Rust error propagation is correct; fix the frontend to use the structure (Part 2), not the Rust side.
- **safeInvoke / isTauriEnvironment** — the mock/fallback pattern is valuable for development; preserve it through the `api.ts` split.
- **Store-per-domain** — do not consolidate stores into a single state object; the current model is composable and correct.
- **Async Tokio throughout Rust** — no synchronous blocking in command handlers; maintain this as new commands are added.
