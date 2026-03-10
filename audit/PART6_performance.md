# Prism Calendar — Architecture Audit
## PART 6: Performance

This section covers memory growth, query performance, concurrency, and rendering bottlenecks.

---

## Memory

### Issue — eventsStore Cache Is Unbounded (HIGH)

`eventsStore` uses an `EventCache` backed by a `Map<id, Event>` that grows without limit. Each call to `loadRange()` inserts events into the map and never removes them. A user who opens the app daily for three years will accumulate the full event history in memory from the first range load.

The read path compounds this: `eventsInRange()` calls:
```typescript
Array.from(cache.values()).filter(event => /* date range check */)
```

This is an O(n) linear scan across the **entire cache** on every render cycle — once per view mount, once per navigation, and once on every store update that triggers a reactive recalculation.

**Recommended fix — LRU eviction:**
Cap the cache at ~2,000 entries. On each `loadRange()` call, evict entries whose `start_time` falls outside ±6 months from the current view date:

```typescript
const MAX_CACHE_ENTRIES = 2000;
const EVICT_BEYOND_MONTHS = 6;

function pruneCache(viewDate: Date) {
    const cutoff = subMonths(viewDate, EVICT_BEYOND_MONTHS);
    const horizon = addMonths(viewDate, EVICT_BEYOND_MONTHS);
    for (const [id, event] of cache) {
        if (event.start_time < cutoff || event.start_time > horizon) {
            cache.delete(id);
        }
    }
}
```

For the read path, replace the linear filter with a sorted structure (e.g. an array sorted by `start_time` + binary search for range bounds), or accept the linear scan and compensate with the cache size cap.

### Issue — tasks_list Returns ALL Tasks by Default (MEDIUM)

With no date argument, `tasks_list` issues:
```sql
SELECT * FROM tasks ORDER BY created_at DESC
```

This is an unbounded query. A user with three years of tasks loads all of them into a single in-memory array on every app boot. There is no pagination, no limit, and no default date window.

**Recommended fix:**
```rust
// Add optional date window with a sensible default
pub async fn list_tasks(
    pool: &DbPool,
    date_from: Option<NaiveDate>,
    date_to: Option<NaiveDate>,
    limit: Option<i64>,
) -> Result<Vec<Task>> {
    let from = date_from.unwrap_or_else(|| Local::now().date_naive() - Duration::days(180));
    let to   = date_to.unwrap_or_else(|| Local::now().date_naive() + Duration::days(180));
    sqlx::query_as!(Task,
        "SELECT * FROM tasks WHERE date BETWEEN ? AND ? ORDER BY date ASC LIMIT ?",
        from, to, limit.unwrap_or(500)
    )
    .fetch_all(pool)
    .await
}
```

Provide a separate `tasks_list_all` command for export/analytics use cases that need the full set.

---

## Query Performance

### Issue — update_task / update_event Use 2 Queries (MEDIUM)

Both update functions issue a `SELECT` (load existing record) followed by an `UPDATE` (write merged result). This is a read-modify-write pattern that:

1. Doubles the number of round-trips to SQLite for every edit.
2. Introduces a race: if two updates to the same record arrive close together, the second `SELECT` may read stale data from before the first `UPDATE` commits.

**Recommended fix — single-query partial update with COALESCE:**
```sql
UPDATE events
SET
    title       = COALESCE(?1, title),
    start_ts    = COALESCE(?2, start_ts),
    end_ts      = COALESCE(?3, end_ts),
    category_id = COALESCE(?4, category_id),
    updated_at  = CURRENT_TIMESTAMP
WHERE id = ?5
RETURNING *;
```

Pass `None`/`NULL` for fields not being updated. SQLite's `COALESCE` keeps the existing value when the input is `NULL`, eliminating the `SELECT` round-trip entirely.

### Issue — Events Range Query Misses Spanning Events (CRITICAL)

Covered in detail in Part 2. Summary: `WHERE start_ts >= ? AND end_ts <= ?` silently drops multi-day events that start before the queried range. Beyond correctness, the correct predicate `start_ts < range_end AND end_ts > range_start` also performs identically at index level — there is no performance trade-off in fixing it.

---

## Concurrency

### Issue — SQLite WAL Mode Not Enabled (CRITICAL)

The 10-connection pool in `pool.rs` provides no concurrency benefit without WAL mode. In default (`DELETE`) journal mode, SQLite uses a single writer lock that blocks all readers. With WAL mode:

- Readers do not block writers.
- Writers do not block readers.
- Multiple concurrent reads are fully parallel.

The fix is three pragma lines in `pool.rs` (see Part 4). This is the highest-impact single-line change in the codebase.

---

## IPC Overhead

### Issue — suggestions_stub Crosses IPC for Zero Value

`suggestions_stub()` is a registered Tauri command that returns an empty `Vec<String>`. Every call from the frontend crosses the Tauri IPC boundary (serialisation, inter-process message, deserialisation, allocation) and returns nothing useful. Remove this command from `invoke_handler!` until the suggestions feature is actually built.

---

## Binary Size

### Issue — OAuth Dependencies Are ~60% of Binary Size

`axum`, `tower`, `tower-http`, `reqwest`, and `oauth2` are used exclusively for the Gmail OAuth flow — a single optional integration. These crates account for approximately 60% of the compiled binary size and represent a significant compile-time cost on every build.

Replacing the entire group with `tauri-plugin-oauth` (which uses Tauri's own deep link system for the OAuth callback) would reduce binary size meaningfully and eliminate all five crates from `Cargo.toml`. See Part 7 for the recommended migration.

---

## Summary

| Issue | Severity | File | Impact |
|---|---|---|---|
| eventsStore cache unbounded | High | `eventsStore.ts` | Memory grows O(n) with calendar age |
| tasks_list unbounded query | Medium | `tasks_repo.rs` | Full table scan on every boot |
| update_task / update_event 2 queries | Medium | `tasks_repo.rs`, `events_repo.rs` | Double IPC latency per edit |
| Events range query bug | Critical | `events_repo.rs` | Multi-day events silently dropped |
| No SQLite WAL mode | Critical | `pool.rs` | Pool provides zero concurrency |
| suggestions_stub IPC overhead | Tech Debt | `main.rs` | Dead IPC traffic |
| OAuth binary size (~60%) | High | `Cargo.toml` | Large binary, slow compile times |
