use sqlx::SqlitePool;

use crate::{
    domain::{PomodoroSession, NewPomodoroSession},
    error::AppError,
};

pub async fn insert_pomodoro_session(
    pool: &SqlitePool,
    new_session: NewPomodoroSession,
) -> Result<PomodoroSession, AppError> {
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO pomodoro_sessions(task_id, kind, started_at, ended_at, duration_minutes, completed)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id"#,
    )
    .bind(new_session.task_id)
    .bind(&new_session.kind)
    .bind(&new_session.started_at)
    .bind(&new_session.ended_at)
    .bind(new_session.duration_minutes)
    .bind(new_session.completed)
    .fetch_one(pool)
    .await?;

    get_pomodoro_session(pool, id).await
}

async fn get_pomodoro_session(pool: &SqlitePool, id: i64) -> Result<PomodoroSession, AppError> {
    let session = sqlx::query_as::<_, PomodoroSession>(
        r#"SELECT id, task_id, kind, started_at, ended_at, duration_minutes, completed
           FROM pomodoro_sessions WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(session)
}

pub async fn list_pomodoro_sessions_for_date(
    pool: &SqlitePool,
    date_iso: &str,
) -> Result<Vec<PomodoroSession>, AppError> {
    let sessions = sqlx::query_as::<_, PomodoroSession>(
        r#"SELECT id, task_id, kind, started_at, ended_at, duration_minutes, completed
           FROM pomodoro_sessions
           WHERE DATE(started_at) = ?
           ORDER BY started_at DESC"#,
    )
    .bind(date_iso)
    .fetch_all(pool)
    .await?;
    Ok(sessions)
}

pub async fn list_pomodoro_sessions_range(
    pool: &SqlitePool,
    start_iso: &str,
    end_iso: &str,
) -> Result<Vec<PomodoroSession>, AppError> {
    let sessions = sqlx::query_as::<_, PomodoroSession>(
        r#"SELECT id, task_id, kind, started_at, ended_at, duration_minutes, completed
           FROM pomodoro_sessions
           WHERE started_at >= ? AND started_at <= ?
           ORDER BY started_at DESC"#,
    )
    .bind(start_iso)
    .bind(end_iso)
    .fetch_all(pool)
    .await?;
    Ok(sessions)
}

