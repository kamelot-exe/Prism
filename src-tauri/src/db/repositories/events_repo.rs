use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

use crate::{
    domain::{Event, NewEvent, UpdateEvent},
    error::AppError,
};

fn map_bool(value: bool) -> i32 {
    if value {
        1
    } else {
        0
    }
}

pub async fn list_events(
    pool: &SqlitePool,
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
) -> Result<Vec<Event>, AppError> {
    let events = if let (Some(start_ts), Some(end_ts)) = (start, end) {
        sqlx::query_as::<_, Event>(
            r#"SELECT id, title, description, start_ts, end_ts, category_id, all_day as "all_day: bool", recurrence_rule,
                reminder_minutes, source, external_id, created_at, updated_at
            FROM events
            WHERE start_ts >= ? AND end_ts <= ?
            ORDER BY start_ts"#,
        )
        .bind(start_ts)
        .bind(end_ts)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Event>(
            r#"SELECT id, title, description, start_ts, end_ts, category_id, all_day as "all_day: bool", recurrence_rule,
                reminder_minutes, source, external_id, created_at, updated_at
            FROM events
            ORDER BY start_ts"#,
        )
        .fetch_all(pool)
        .await?
    };
    Ok(events)
}

pub async fn create_event(pool: &SqlitePool, payload: NewEvent) -> Result<Event, AppError> {
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO events
        (title, description, start_ts, end_ts, category_id, all_day, recurrence_rule, reminder_minutes, source, external_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id"#,
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(payload.start_ts)
    .bind(payload.end_ts)
    .bind(payload.category_id)
    .bind(map_bool(payload.all_day))
    .bind(&payload.recurrence_rule)
    .bind(payload.reminder_minutes)
    .bind(&payload.source)
    .bind(&payload.external_id)
    .fetch_one(pool)
    .await?;

    get_event(pool, id).await
}

pub async fn get_event(pool: &SqlitePool, id: i64) -> Result<Event, AppError> {
    let event = sqlx::query_as::<_, Event>(
        r#"SELECT id, title, description, start_ts, end_ts, category_id, all_day as "all_day: bool", recurrence_rule,
            reminder_minutes, source, external_id, created_at, updated_at
        FROM events WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(event)
}

pub async fn update_event(pool: &SqlitePool, payload: UpdateEvent) -> Result<Event, AppError> {
    let existing = get_event(pool, payload.id).await?;
    let title = payload.title.unwrap_or(existing.title);
    let description = payload.description.or(existing.description);
    let start_ts = payload.start_ts.unwrap_or(existing.start_ts);
    let end_ts = payload.end_ts.unwrap_or(existing.end_ts);
    let category_id = payload.category_id.or(existing.category_id);
    let all_day = payload.all_day.unwrap_or(existing.all_day);
    let recurrence_rule = payload.recurrence_rule.or(existing.recurrence_rule);
    let reminder_minutes = payload.reminder_minutes.or(existing.reminder_minutes);

    sqlx::query(
        r#"UPDATE events SET title = ?, description = ?, start_ts = ?, end_ts = ?, category_id = ?, all_day = ?,
        recurrence_rule = ?, reminder_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"#,
    )
    .bind(title)
    .bind(description)
    .bind(start_ts)
    .bind(end_ts)
    .bind(category_id)
    .bind(map_bool(all_day))
    .bind(recurrence_rule)
    .bind(reminder_minutes)
    .bind(payload.id)
    .execute(pool)
    .await?;

    get_event(pool, payload.id).await
}

pub async fn delete_event(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM events WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
