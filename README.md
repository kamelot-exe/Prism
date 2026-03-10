# Prism Calendar

Prism Calendar is a local-first desktop productivity calendar built with Svelte, TypeScript, Tauri, Rust, and SQLite.

## Current Scope

- Calendar views: month, week, day
- Tasks and focus tasks
- Time blocking and planner blocks
- Pomodoro and focus mode
- Recurrence and reminders
- Productivity insights
- Multi-calendar support
- ICS and CSV export
- Local settings and themes

## Stack

- Frontend: Svelte + TypeScript + Vite
- Desktop shell: Tauri 2
- Backend: Rust
- Database: SQLite via `sqlx`

## Development

Prerequisites:

- Node.js 18+
- Rust stable
- Tauri prerequisites for your OS

Install and run:

```bash
npm install
npm run tauri:dev
```

Build a desktop bundle:

```bash
npm run tauri:build
```

## Project Areas

- `src/`: Svelte UI, stores, scheduling, export, reminders
- `src-tauri/src/api/`: Tauri commands
- `src-tauri/src/db/`: pool, migrations, repositories
- `src-tauri/src/domain/`: domain models and parsing
- `public/themes/`: built-in themes

## Release Notes

The app stays local-first. Calendar data, tasks, settings, reminders, and exports are handled on-device. There is no cloud sync in the current product scope.
