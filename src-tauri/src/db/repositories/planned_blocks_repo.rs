use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

use crate::{
    domain::{NewPlannedBlock, PlannedBlock, UpdatePlannedBlock},
    error::AppError,
};

fn map_bool(value: bool) -> i32 {
    if value { 1 } else { 0 }
}

pub async fn create_planned_block(
    pool: &SqlitePool,
    payload: NewPlannedBlock,
) -> Result<PlannedBlock, AppError> {
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO planned_blocks(task_id, event_id, title, start_ts, end_ts, completed)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id"#,
    )
    .bind(payload.task_id)
    .bind(payload.event_id)
    .bind(&payload.title)
    .bind(payload.start_ts)
    .bind(payload.end_ts)
    .bind(map_bool(payload.completed.unwrap_or(false)))
    .fetch_one(pool)
    .await?;

    get_planned_block(pool, id).await
}

pub async fn get_planned_block(pool: &SqlitePool, id: i64) -> Result<PlannedBlock, AppError> {
    let block = sqlx::query_as::<_, PlannedBlock>(
        r#"SELECT id, task_id, event_id, title, start_ts, end_ts,
                  completed as "completed: bool", created_at
           FROM planned_blocks WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(block)
}

pub async fn update_planned_block(
    pool: &SqlitePool,
    payload: UpdatePlannedBlock,
) -> Result<PlannedBlock, AppError> {
    let existing = get_planned_block(pool, payload.id).await?;
    let task_id = payload.task_id.or(existing.task_id);
    let event_id = payload.event_id.or(existing.event_id);
    let title = payload.title.unwrap_or(existing.title);
    let start_ts = payload.start_ts.unwrap_or(existing.start_ts);
    let end_ts = payload.end_ts.unwrap_or(existing.end_ts);
    let completed = payload.completed.unwrap_or(existing.completed);

    sqlx::query(
        r#"UPDATE planned_blocks
           SET task_id = ?, event_id = ?, title = ?, start_ts = ?, end_ts = ?, completed = ?
           WHERE id = ?"#,
    )
    .bind(task_id)
    .bind(event_id)
    .bind(title)
    .bind(start_ts)
    .bind(end_ts)
    .bind(map_bool(completed))
    .bind(payload.id)
    .execute(pool)
    .await?;

    get_planned_block(pool, payload.id).await
}

pub async fn delete_planned_block(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM planned_blocks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_planned_blocks_range(
    pool: &SqlitePool,
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
) -> Result<Vec<PlannedBlock>, AppError> {
    let blocks = if let (Some(start_ts), Some(end_ts)) = (start, end) {
        sqlx::query_as::<_, PlannedBlock>(
            r#"SELECT id, task_id, event_id, title, start_ts, end_ts,
                      completed as "completed: bool", created_at
               FROM planned_blocks
               WHERE start_ts < ? AND end_ts > ?
               ORDER BY start_ts"#,
        )
        .bind(end_ts)
        .bind(start_ts)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, PlannedBlock>(
            r#"SELECT id, task_id, event_id, title, start_ts, end_ts,
                      completed as "completed: bool", created_at
               FROM planned_blocks
               ORDER BY start_ts"#,
        )
        .fetch_all(pool)
        .await?
    };

    Ok(blocks)
}
