# Prism Calendar Architecture Plan

## 1. Overview
Prism Calendar is a desktop calendar application built with Svelte 4 + TypeScript on the frontend and Tauri 2.x + Rust on the backend. SQLite (via sqlx) stores local data, and the app includes an initial Google Calendar read-only sync pipeline. The goal is to deliver a clean, modular architecture that supports rich calendar views, event/category management, advanced themes, and productivity features while keeping the codebase maintainable and testable.

## 2. Current State (Summary)
### Frontend structure
- `src/App.svelte` coordinates top-level layout (TopBar, Sidebar, Month/Week/Day view switching) with local `currentDate`, `viewMode`, and `searchQuery` state.
- Components under `src/components/` include modals (EventModal, QuickAddModal), layout (TopBar, Sidebar), visual helpers (ThemedCard, ColorPicker), and view components in `components/views/` (MonthView, WeekView, DayView).
- Data access is directly through `src/lib/api.ts`, a thin, untyped invoke wrapper. Only events and categories are covered; commands are stringly typed.
- Theme loading handled by `src/lib/theme.ts` using JSON files in `public/themes/`; applies CSS variables at runtime. `ThemedCard` consumes themes per-component.
- State management is minimal: `src/stores/settings.ts` contains theme and preference handling, with TODOs for Tauri-backed persistence. Other domain data (events/categories) are managed ad-hoc in components rather than shared stores.

### Backend structure
- Tauri commands live in `src-tauri/src/api/{events,categories,gmail}.rs` exported via `main.rs`.
- Database setup in `db/pool.rs` (global mutable pool) and migrations in `db/migrations.rs` (inline migration functions).
- Gmail integration in `src-tauri/src/gmail/` with OAuth handling and sync logic mixed into the module; Tauri commands call directly into this layer.
- No clear separation between API/command layer, domain logic, and persistence; error handling returns `String` messages.

### DB & migrations
- Inline migrations create `events`, `categories`, `settings`, and `migrations` tables; a second migration adds `source` and `external_id` to `events` plus an index.
- No tasks/todo or reminder tables yet; settings stored as key/value strings.

### Existing integrations (Gmail)
- OAuth flow using `oauth2` crate, keyring for refresh token, and Axum local HTTP callback. Sync pulls events from primary calendar into `events` table with `source="gmail"` and `external_id` fields; no batching or conflict strategy beyond upsert-by-source/external_id.

### Problems / pain points / risks
- Tight coupling: UI components directly invoke Tauri commands without domain stores; backend commands mix validation, DB access, and domain logic.
- Weak typing and validation for commands; error handling is string-based.
- Global mutable DB pool; no structured migration management beyond manual functions.
- Theme system and settings are partially implemented; settings persistence TODO.
- Productivity features (Quick Add, To-Do, Pomodoro) not present in data model or backend.
- Google sync lacks scheduling, conflict policies, and robust token/error handling surfaces to UI.

## 3. Target Architecture
### Overall (textual diagram)
UI Components → Svelte Stores (UI, events, categories, settings, productivity) → Typed API client (`lib/api.ts`) → Tauri Commands (API layer) → Domain Services (event/category/task/sync logic) → Repository (sqlx) → SQLite. Themes loaded via theme service (CSS variables) feeding UI tokens.

### Frontend structure and responsibilities
- `src/components/`: Presentational, stateless UI pieces (buttons, cards, form controls, calendar cells).
- `src/components/views/`: View shells for Day/Week/Month; consume stores, render layout, orchestrate modals.
- `src/components/layout/`: TopBar, Sidebar, MainLayout; host navigation and theme toggles.
- `src/components/modals/`: EventModal, QuickAddModal, CategoryModal, SettingsModal, etc.
- `src/components/productivity/`: Todo panel, Pomodoro timer, DailySummary widgets.
- `src/components/settings/`: ThemeSwitcher, CategoryManager, AccountSync (Google), Preferences forms.
- `src/stores/`: Domain stores (`eventsStore`, `categoriesStore`, `tasksStore`, `settingsStore`, `uiStore`, `syncStore`). Stores encapsulate loading, mutations via API client, optimistic updates, and derived data (filters, grouping).
- `src/lib/api.ts`: Typed invoke wrapper grouped by domain (events, categories, tasks, settings, sync). Handles shape validation/parsing and maps backend errors to typed results.
- `src/lib/theme/`: Theme registry, loader, token definitions, helpers for CSS variable injection, and ThemeSwitcher integration.
- View switching remains simple (local state or lightweight router); sidebar includes year mini-calendar driving the active date store.

### Backend structure and responsibilities
- `src-tauri/src/api/`: Thin command layer (input validation, error mapping) delegating to domain services. Modules: `events_api.rs`, `categories_api.rs`, `tasks_api.rs`, `settings_api.rs`, `gmail_api.rs`.
- `src-tauri/src/domain/`: Business logic + DTOs (event rules, recurrence, reminders, quick-add parsing stub, sync policies).
- `src-tauri/src/db/`: Pool/init, migrations (sqlx migrations folder or embedded), repository modules per aggregate (events_repo, categories_repo, tasks_repo, settings_repo, sync_repo) returning typed structs and errors.
- `src-tauri/src/gmail/`: OAuth client, Google Calendar client, sync service (read-only) that writes via repositories; isolates HTTP concerns from domain.
- Error handling via a shared error type implementing `thiserror` + `Into<tauri::Error>` mapping to structured frontend errors.
- App state injects DB pool and services into commands using Tauri `State` to avoid globals.

### Data flow
1. UI triggers store actions (e.g., `eventsStore.create`).
2. Store calls typed API client which invokes Tauri command.
3. Command validates input, calls domain service; service uses repositories to query/update SQLite.
4. Result mapped to DTO sent back to frontend; store updates local cache, views reactively re-render.
5. Google sync initiated via `syncStore` → `gmail_api` → Gmail sync service → repositories; synced events marked `source="google"` (or `gmail`) with `external_id`.

## 4. Data Model
- `events` (`id`, `title`, `description`, `start_ts`, `end_ts`, `all_day` BOOL, `category_id` FK, `recurrence_rule` TEXT, `reminder_minutes` INTEGER, `source` TEXT, `external_id` TEXT, `created_at`, `updated_at`). Index on (`start_ts`, `end_ts`); unique index on (`source`, `external_id`).
- `categories` (`id`, `name` UNIQUE, `color_hex` TEXT, `created_at`).
- `tasks` (`id`, `title`, `done` BOOL DEFAULT 0, `date_ts` DATETIME NULL for unscheduled, `created_at`, `updated_at`).
- `settings` (`key` PRIMARY KEY, `value` JSON/TEXT) for theme, time format, first day of week, pomodoro defaults, user category color overrides.
- Optional `reminders` table in future for multiple reminders per event.
- Google events: stored in `events` with `source='google'` (or `gmail`) and `external_id` from Google; recurrence expansion handled at sync time or view layer later.

## 5. Tauri Command API
(Names are stable, typed inputs/outputs shared with frontend.)
- Events: `events_list(start_ts?, end_ts?)`, `events_create(EventCreate)`, `events_update(EventUpdate)`, `events_delete(id)`, `events_bulk_upsert` (for sync). Returns typed DTO with category info.
- Categories: `categories_list()`, `categories_create(name, color_hex)`, `categories_update(id, name?, color_hex?)`, `categories_delete(id)`.
- Tasks: `tasks_list(date_ts?)`, `tasks_create(title, date_ts?)`, `tasks_toggle_done(id, done)`, `tasks_delete(id)`.
- Settings: `settings_get()`, `settings_save(SettingsPayload)`, `settings_set_theme(theme_name)`.
- Gmail/Sync: `gmail_get_auth_url()`, `gmail_exchange_code(code)`, `gmail_disconnect()`, `gmail_sync(time_min?, time_max?)`, `sync_status()`.
- Error handling: commands return `Result<T, AppError>` where `AppError` includes code (e.g., `validation`, `not_found`, `db`, `network`, `auth`) and message; frontend maps codes to user-friendly notifications.

## 6. State Management (Frontend)
- `eventsStore`: fetch by range, cache by day/week/month, support filters/search, expose derived groups for views.
- `categoriesStore`: load once, manage create/update/delete, provide color lookup.
- `tasksStore`: per-day tasks CRUD, toggle done, derived stats.
- `settingsStore`: theme, locale prefs, persist via settings API, apply themes.
- `uiStore`: modal visibility, selected date, active view, loading indicators, notifications.
- `syncStore`: Google auth state, last sync status, in-progress flags.
- Stores interact only through events (e.g., `settingsStore` theme changes inform UI via CSS variables); components subscribe rather than calling API directly.

## 7. Theme System
- Theme tokens defined in `src/lib/theme/themes/*.ts` (or JSON in `public/themes/`) with consistent keys (bg, text, accent, radii, shadows, gradients, surface tokens). Export registry for ThemeSwitcher.
- `theme.service` loads theme, applies CSS variables to `:root`, and persists selection via settings API. Supports “auto” (system), core light/dark, and advanced themes (Glass, Aurora Neon, Claymorphism, Brutalism, Blueprint, Sunset, Cyber Minimal, etc.).
- Components consume tokens via CSS variables only; no theme-specific logic in components. ThemedCard becomes a thin wrapper around CSS utility classes; advanced themes can be added by dropping new token files without touching components.

## 8. Productivity Features
- Quick Add: UI accepts natural-language-friendly text; store sends to `events_create` with optional future parser hook; quick-add modal uses same store flows as EventModal.
- To-Do: tasks table + `tasksStore`; sidebar/daily view panel shows tasks for selected date; Tauri commands manage persistence.
- Pomodoro: lightweight store (focus/break lengths, running state) persisted in settings; timer component uses browser/desktop notifications; no DB table needed unless logging sessions later.
- Daily/Weekly summary: derived from events/tasks stores (counts, durations, completed tasks) with no extra persistence.

## 9. Migration & Refactor Plan
1. **Scaffold architecture**: Create frontend folder layout (stores, lib/api regrouped, theme module) and backend module skeleton (`domain`, `db` repos, API modules) without altering behavior.
2. **Database alignment**: Introduce sqlx migrations folder with target schema (events fields, tasks table). Add typed models/DTOs.
3. **API cleanup**: Replace stringly commands with typed ones, structured errors, and state-injected services. Update frontend `lib/api.ts` accordingly.
4. **Store adoption**: Move event/category logic into stores; wire views to stores; add tasks/settings/sync stores.
5. **Theme revamp**: Implement theme registry and CSS variable pipeline; update components to use tokens; add advanced themes.
6. **Productivity modules**: Implement Quick Add plumbing, tasks UI, and Pomodoro component tied to settings store.
7. **Gmail sync hardening**: Add sync service orchestration, status reporting, token handling, and conflict-safe upsert strategy; surface statuses in UI.
8. **Incremental view refactor**: Clean up Month/Week/Day to consume stores, support search/filter, and integrate category colors + mini-calendar.
9. **Testing & polish**: Add backend unit/integration tests for services/repos; frontend smoke tests; ensure error handling and migrations are resilient.
