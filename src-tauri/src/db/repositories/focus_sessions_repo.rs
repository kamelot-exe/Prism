use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

use crate::{
    domain::{CompleteFocusSession, FocusSession, NewFocusSession},
    error::AppError,
};

pub async fn create_focus_session(
    pool: &SqlitePool,
    payload: NewFocusSession,
) -> Result<FocusSession, AppError> {
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO focus_sessions(task_id, planned_block_id, started_at, ended_at, duration_minutes)
           VALUES (?, ?, ?, ?, ?) RETURNING id"#,
    )
    .bind(payload.task_id)
    .bind(payload.planned_block_id)
    .bind(payload.started_at)
    .bind(payload.ended_at)
    .bind(payload.duration_minutes)
    .fetch_one(pool)
    .await?;

    get_focus_session(pool, id).await
}

pub async fn get_focus_session(pool: &SqlitePool, id: i64) -> Result<FocusSession, AppError> {
    let session = sqlx::query_as::<_, FocusSession>(
        r#"SELECT id, task_id, planned_block_id, started_at, ended_at, duration_minutes
           FROM focus_sessions WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(session)
}

pub async fn complete_focus_session(
    pool: &SqlitePool,
    payload: CompleteFocusSession,
) -> Result<FocusSession, AppError> {
    let existing = get_focus_session(pool, payload.id).await?;
    let ended_at = payload.ended_at.unwrap_or_else(Utc::now);
    let duration_minutes = payload.duration_minutes.unwrap_or_else(|| {
        let diff = ended_at.signed_duration_since(existing.started_at).num_minutes();
        diff.max(0)
    });

    sqlx::query(
        r#"UPDATE focus_sessions SET ended_at = ?, duration_minutes = ? WHERE id = ?"#,
    )
    .bind(ended_at)
    .bind(duration_minutes)
    .bind(payload.id)
    .execute(pool)
    .await?;

    get_focus_session(pool, payload.id).await
}

pub async fn list_focus_sessions_range(
    pool: &SqlitePool,
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
) -> Result<Vec<FocusSession>, AppError> {
    let sessions = if let (Some(start_ts), Some(end_ts)) = (start, end) {
        sqlx::query_as::<_, FocusSession>(
            r#"SELECT id, task_id, planned_block_id, started_at, ended_at, duration_minutes
               FROM focus_sessions
               WHERE started_at >= ? AND started_at <= ?
               ORDER BY started_at DESC"#,
        )
        .bind(start_ts)
        .bind(end_ts)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, FocusSession>(
            r#"SELECT id, task_id, planned_block_id, started_at, ended_at, duration_minutes
               FROM focus_sessions
               ORDER BY started_at DESC"#,
        )
        .fetch_all(pool)
        .await?
    };

    Ok(sessions)
}
