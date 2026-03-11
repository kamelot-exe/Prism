use chrono::{DateTime, Utc};
use tauri::State;

use crate::{
    db::focus_sessions_repo,
    db::DbPool,
    domain::{CompleteFocusSession, FocusSession, NewFocusSession},
    error::AppError,
};

#[allow(non_snake_case)]
#[tauri::command]
pub async fn createFocusSession(
    pool: State<'_, DbPool>,
    payload: NewFocusSession,
) -> Result<FocusSession, AppError> {
    if let Some(ended_at) = payload.ended_at {
        if ended_at < payload.started_at {
            return Err(AppError::Validation("focus session ended_at must be after started_at".to_string()));
        }
    }
    if let Some(duration_minutes) = payload.duration_minutes {
        if duration_minutes < 0 {
            return Err(AppError::Validation("focus session duration_minutes must be >= 0".to_string()));
        }
    }
    focus_sessions_repo::create_focus_session(&pool, payload).await
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn completeFocusSession(
    pool: State<'_, DbPool>,
    payload: CompleteFocusSession,
) -> Result<FocusSession, AppError> {
    if let Some(duration_minutes) = payload.duration_minutes {
        if duration_minutes < 0 {
            return Err(AppError::Validation("focus session duration_minutes must be >= 0".to_string()));
        }
    }
    focus_sessions_repo::complete_focus_session(&pool, payload).await
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn listFocusSessionsRange(
    pool: State<'_, DbPool>,
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
) -> Result<Vec<FocusSession>, AppError> {
    focus_sessions_repo::list_focus_sessions_range(&pool, start, end).await
}
