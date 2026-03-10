use tauri::State;
use chrono::Utc;

use crate::{
    db::pomodoro_repo,
    db::DbPool,
    domain::{NewPomodoroSession, PomodoroSession},
    error::AppError,
};

#[tauri::command]
pub async fn pomodoro_log_session(
    pool: State<'_, DbPool>,
    mut payload: NewPomodoroSession,
) -> Result<PomodoroSession, AppError> {
    // Validate kind
    if payload.kind != "focus" && payload.kind != "break" {
        return Err(AppError::Validation("kind must be 'focus' or 'break'".to_string()));
    }
    
    // Validate duration
    if payload.duration_minutes <= 0 {
        return Err(AppError::Validation("duration_minutes must be > 0".to_string()));
    }
    
    // Ensure started_at is set if not provided
    if payload.started_at.is_empty() {
        payload.started_at = Utc::now().to_rfc3339();
    }
    
    pomodoro_repo::insert_pomodoro_session(&pool, payload).await
}

#[tauri::command]
pub async fn pomodoro_list_for_date(
    pool: State<'_, DbPool>,
    date_iso: String,
) -> Result<Vec<PomodoroSession>, AppError> {
    pomodoro_repo::list_pomodoro_sessions_for_date(&pool, &date_iso).await
}

#[tauri::command]
pub async fn pomodoro_list_range(
    pool: State<'_, DbPool>,
    start_iso: String,
    end_iso: String,
) -> Result<Vec<PomodoroSession>, AppError> {
    pomodoro_repo::list_pomodoro_sessions_range(&pool, &start_iso, &end_iso).await
}

