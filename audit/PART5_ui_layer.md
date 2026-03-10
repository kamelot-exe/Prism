# Prism Calendar — Architecture Audit
## PART 5: UI Layer

This section covers Svelte store design, the IPC client module, TypeScript type hygiene, and frontend patterns.

---

## Store Architecture

### What Is Working Well

The frontend uses a store-per-domain model: `eventsStore`, `tasksStore`, `categoryStore`, `pomodoroStore`, `plannedEventsStore`, `focusStore`, and `uiStore` are cleanly separated. There is no global state object. Each store owns its own IPC calls, caching strategy, and loading state. Stores are composable and independently replaceable.

The `safeInvoke` / `isTauriEnvironment` pattern ensures every backend call degrades gracefully in a browser (non-Tauri) context, which makes dev-mode iteration possible without a running Rust process.

### Issue — api.ts Is a 530-Line God Module (HIGH)

`src/lib/api.ts` is responsible for:
- All TypeScript interface definitions (`Event`, `Task`, `Category`, `PomodoroSession`, `Settings`, `AppSettings`)
- IPC field mapping functions (`mapEventFromApi`, `mapEventToApi`, `mapTaskFromApi`, etc.)
- All Tauri command wrappers (`getEvents`, `createEvent`, `updateEvent`, `deleteEvent`, `listTasks`, …)
- Non-Tauri mock implementations for every command (for browser dev mode)
- Fallback logic and environment gating

Any type change — adding a field to `Event`, renaming a command, or introducing a new domain — requires editing one large, mixed-responsibility file. New contributors cannot tell where types end and invocation logic begins.

**Recommended structure:**

| File | Contents |
|---|---|
| `src/lib/api/types.ts` | All shared TypeScript interfaces (`Event`, `Task`, `Category`, etc.) |
| `src/lib/api/events.ts` | `getEvents`, `createEvent`, `updateEvent`, `deleteEvent`, field mapping |
| `src/lib/api/tasks.ts` | `listTasks`, `createTask`, `updateTask`, `toggleTaskDone`, `deleteTask` |
| `src/lib/api/categories.ts` | `listCategories`, `createCategory`, `updateCategory`, `deleteCategory` |
| `src/lib/api/pomodoro.ts` | `logPomodoroSession`, `listPomodoroForDate`, `listPomodoroRange` |
| `src/lib/api/settings.ts` | `getSettings`, `saveSettings` |
| `src/lib/api/mocks.ts` | All non-Tauri fallback implementations (dev/browser mode) |

Each store imports only from its own domain module. `types.ts` is the only shared import across modules.

---

## TypeScript Type Hygiene

### Issue — Duplicate Settings / AppSettings Interfaces

`Settings` is defined in `src/stores/settings.ts` with `goals`, `weeklyPlan`, `weeklyCarry` fields. `AppSettings` is defined separately in `src/lib/api.ts` without those fields. Both describe the same entity and will silently diverge as features are added.

**Fix:** `src/lib/api.ts` should import from `settings.ts` rather than maintaining a parallel definition:
```typescript
// api.ts — remove the local AppSettings definition
export type { Settings as AppSettings } from '../stores/settings.ts';
```

### Issue — IPC Field Name Impedance Mismatch (HIGH)

Rust uses `snake_case` fields; TypeScript uses `camelCase`. The current approach requires manual mapping in `api.ts`:

```typescript
// api.ts — current (maintenance burden)
function mapEventFromApi(e: any): Event {
    return {
        start_time: e.start_ts,
        end_time:   e.end_ts,
        isFocus:    e.is_focus,
        // ... 12 more lines
    };
}
```

Adding `#[serde(rename)]` attributes to Rust domain structs eliminates all mapping functions. The frontend type definitions then directly match the IPC payload with no translation layer:

```rust
// Rust domain struct — after fix
#[derive(Serialize, Deserialize)]
pub struct Event {
    #[serde(rename = "startTime")]
    pub start_ts: DateTime<Utc>,

    #[serde(rename = "endTime")]
    pub end_ts: DateTime<Utc>,

    #[serde(rename = "isFocus")]
    pub is_focus: bool,
    // ...
}
```

```typescript
// TypeScript — no mapEventFromApi() needed
const event: Event = await safeInvoke('get_event', { id });
console.log(event.startTime); // directly matches Rust serde output
```

---

## Navigation

### Issue — svelte-routing@1.7.0 Is Unused

The application uses `uiStore.setView()` for navigation — not URL routing. `svelte-routing` is never imported in any component. It generates a build warning (`"missing svelte exports condition"`) and adds bundle weight.

**Fix:** Remove from `package.json`.

---

## Focus Store

### Issue — focusStore.finish() Fires Async Inside writable.update()

`focusStore.finish()` calls `notify()` (a Tauri notification command) inside the synchronous `writable.update()` callback. This is the same fire-and-forget anti-pattern that was fixed in `pomodoroStore` during the RC pass.

**Current (unsafe):**
```typescript
focusStore.update((state) => {
    notify('Focus session complete'); // ← async call inside sync callback
    return { ...state, active: false };
});
```

**Fix — same pattern applied to pomodoroStore:**
```typescript
let shouldNotify = false;
focusStore.update((state) => {
    shouldNotify = state.active;
    return { ...state, active: false };
});
if (shouldNotify) {
    notify('Focus session complete').catch(console.error);
}
```

---

## Svelte 5 Migration Planning

Svelte 5 is released and stable. The runes model (`$state`, `$derived`, `$effect`) maps cleanly onto the existing `writable`/`derived` store patterns. A migration is not urgent — Svelte 4 remains supported — but it should be planned now so the codebase does not accumulate more patterns that need double-migration later.

| Svelte 4 Pattern | Svelte 5 Rune Equivalent |
|---|---|
| `let x = 0;` / `writable(0)` | `let x = $state(0)` |
| `$: derived = ...` | `let derived = $derived(...)` |
| `onMount` / `onDestroy` | `$effect(() => { return () => cleanup })` |
| `createEventDispatcher` | Function callback props |
| `<slot>` | `{@render children()}` |

**Recommended migration order:**
1. Start with leaf components that have no child components: `ToastContainer`, `Pomodoro`, `CategoryTag`.
2. Work inward toward container components: `Sidebar`, `WeekView`, `App`.
3. Migrate stores last — the store-per-domain model maps directly to module-level `$state` declarations in Svelte 5.

---

## Summary

| Issue | Severity | File |
|---|---|---|
| api.ts god module | High | `src/lib/api.ts` |
| IPC field name mismatch | High | `src/lib/api.ts`, all domain Rust structs |
| Duplicate Settings / AppSettings | Tech Debt | `settings.ts`, `api.ts` |
| svelte-routing unused | Tech Debt | `package.json` |
| focusStore async in update() | Tech Debt | `src/lib/focusStore.ts` |
| Svelte 5 migration unplanned | Low | All `.svelte` files and stores |
