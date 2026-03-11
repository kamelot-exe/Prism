CREATE TABLE IF NOT EXISTS planned_blocks (
    id INTEGER PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    start_ts DATETIME NOT NULL,
    end_ts DATETIME NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK(end_ts > start_ts)
);

CREATE INDEX IF NOT EXISTS idx_planned_blocks_start_ts
    ON planned_blocks(start_ts);

CREATE INDEX IF NOT EXISTS idx_planned_blocks_start_end
    ON planned_blocks(start_ts, end_ts);

CREATE INDEX IF NOT EXISTS idx_planned_blocks_task_start
    ON planned_blocks(task_id, start_ts);

CREATE TABLE IF NOT EXISTS recurrence_exceptions (
    id INTEGER PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,
    action TEXT NOT NULL,
    new_start_ts DATETIME,
    new_end_ts DATETIME,
    CHECK(action IN ('skip', 'modify')),
    CHECK(
        action = 'skip'
        OR new_start_ts IS NULL
        OR new_end_ts IS NULL
        OR new_end_ts > new_start_ts
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recurrence_exceptions_event_occurrence
    ON recurrence_exceptions(event_id, occurrence_date);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    planned_block_id INTEGER REFERENCES planned_blocks(id) ON DELETE SET NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    duration_minutes INTEGER,
    CHECK(duration_minutes IS NULL OR duration_minutes >= 0),
    CHECK(ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at
    ON focus_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_started_at
    ON focus_sessions(task_id, started_at);
