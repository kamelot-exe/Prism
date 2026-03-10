# Prism Calendar — Architecture Audit
## PART 1: Architecture Overview

**Stack:** Tauri v2 · Svelte 4 · TypeScript · Rust · SQLite
**Scope:** Project structure, module boundaries, separation of concerns, IPC bridge design
**Date:** March 2026
**Verdict:** Sound foundation. Four critical issues require immediate attention before production release.

---

## Executive Summary

Prism Calendar is a well-structured local-first desktop application. The separation of concerns between Rust backend and Svelte frontend is clear, the repository pattern is correctly applied, and prepared statements prevent SQL injection. However, four critical defects pose risks to data integrity and application stability, and several architectural patterns will create maintenance pain at scale.

This audit covers: project structure, module boundaries, state management, the Rust ↔ frontend IPC bridge, schema design, dependency health, and scalability risks. All recommendations are pragmatic improvements — no rewrites are proposed.

| Category   | Count    | Headline                                        |
|------------|----------|-------------------------------------------------|
| Critical   | 4 issues | Data loss, startup race, silent query bug       |
| High       | 7 issues | Ephemeral user data, duplicate logic, god module |
| Medium     | 6 issues | Non-queryable schema, unbounded queries, dead columns |
| Tech Debt  | 8 items  | Unused deps, duplicate types, vestigial code    |

---

## Project Structure

Prism Calendar follows a clean two-tier layout: a Rust backend in `src-tauri/` and a Svelte frontend in `src/`. The Rust layer is further organised as:

```
src-tauri/
  src/
    api/          # Tauri command handlers (zero SQL here)
    db/
      repositories/  # All SQL — one file per domain
      pool.rs        # Connection pool init + migrations
    domain/       # Pure business logic (recurrence, task parsing)
    error.rs      # Unified AppError implementing Serialize
  migrations/     # sqlx versioned migrations
```

The frontend follows a parallel domain split:

```
src/
  stores/         # One writable store per domain
  components/
    views/        # Calendar views (Day, Week, Month)
    common/       # Shared UI (Toast, Modal, Sidebar)
    productivity/ # Pomodoro, Focus, TodoPanel
  lib/
    api.ts        # All IPC wrappers (currently a god module — see Part 5)
    safeInvoke.ts # Tauri invoke wrapper
```

---

## Module Boundaries

The repository pattern is correctly applied. Every SQL statement lives in `db/repositories/`. Command handlers in `api/` call repository functions and return domain types — they contain no SQL. This boundary makes the DB layer independently testable and replaceable.

The domain layer in `domain/` contains pure Rust logic (recurrence expansion, NLP task parsing) with no database dependencies. `domain/recurrence.rs` includes unit tests — the only tested domain logic in the codebase and a good foundation to build on.

The Tauri IPC boundary is the main seam between layers. All frontend-to-backend calls go through `src/lib/safeInvoke.ts`. This gate is architecturally correct; its error-handling behaviour is a concern addressed in Part 2.

---

## IPC Bridge Design

The IPC bridge uses Tauri's typed command system. Rust command handlers are registered in `main.rs` via `invoke_handler!`. The frontend calls them via `safeInvoke(commandName, args)`.

**What works well:**
- `AppError` implements `serde::Serialize`, so Rust errors cross the boundary as structured data rather than panic strings.
- `isTauriEnvironment()` gates every call — non-Tauri environments (browser dev mode) fall back to mock implementations in `api.ts`.

**Structural problem — field name impedance mismatch:**
Rust uses `snake_case` field names (`start_ts`, `end_ts`, `is_focus`, `estimated_minutes`, `days_of_week`). TypeScript uses `camelCase` (`start_time`, `end_time`, `isFocus`, `estimatedMinutes`, `daysOfWeek`). This mismatch requires `mapEventFromApi()`, `mapEventToApi()`, and equivalent mapping functions for every domain type in `api.ts`. Adding `#[serde(rename = "camelCaseName")]` attributes to Rust structs would eliminate all mapping code. See Part 7 for the recommended migration.

---

## What Is Working Well

These patterns are solid and should be preserved as the codebase evolves.

| Strength | Why It Matters |
|---|---|
| Repository pattern in Rust | All SQL is isolated in `db/repositories/`. Command handlers contain zero SQL. This boundary makes the DB layer testable and swappable. |
| sqlx prepared statements | SQL injection is structurally impossible. All queries use `.bind()` — no string concatenation. |
| AppError as Serialize | Rust errors cross the IPC boundary as structured data, not panic strings. The pattern is correct; the frontend just needs to use the structure (see Part 2). |
| safeInvoke / isTauriEnvironment | Every backend call is gated through one function. Non-Tauri environments degrade gracefully. This makes browser-based development and testing possible. |
| Recurrence logic in Rust with tests | `domain/recurrence.rs` has unit tests for daily, weekly, and monthly recurrence. This is the only tested domain logic in the codebase — a good foundation to build on. |
| Async Tokio throughout Rust | All command handlers are `async`, all DB calls are awaited. No blocking on the Tauri main thread. |
| Store-per-domain state model | `eventsStore`, `tasksStore`, `categoryStore`, `pomodoroStore` are cleanly separated. There is no global state object. Stores are composable and independently replaceable. |
| ON DELETE SET NULL FKs | Both `pomodoro_sessions.task_id` and `events.category_id` use `ON DELETE SET NULL`, preventing orphaned records on deletion. Foreign keys just need `PRAGMA foreign_keys=ON` to be enforced. |
