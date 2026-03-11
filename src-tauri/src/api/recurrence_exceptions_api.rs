use tauri::State;

use crate::{
    db::recurrence_exceptions_repo,
    db::DbPool,
    domain::{NewRecurrenceException, RecurrenceException},
    error::AppError,
};

#[allow(non_snake_case)]
#[tauri::command]
pub async fn createRecurrenceException(
    pool: State<'_, DbPool>,
    payload: NewRecurrenceException,
) -> Result<RecurrenceException, AppError> {
    if payload.action != "skip" && payload.action != "modify" {
        return Err(AppError::Validation("recurrence exception action must be 'skip' or 'modify'".to_string()));
    }
    if let (Some(start_ts), Some(end_ts)) = (&payload.new_start_ts, &payload.new_end_ts) {
        if end_ts <= start_ts {
            return Err(AppError::Validation("recurrence exception new_end_ts must be after new_start_ts".to_string()));
        }
    }
    recurrence_exceptions_repo::create_recurrence_exception(&pool, payload).await
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn listRecurrenceExceptions(
    pool: State<'_, DbPool>,
    event_id: Option<i64>,
) -> Result<Vec<RecurrenceException>, AppError> {
    recurrence_exceptions_repo::list_recurrence_exceptions(&pool, event_id).await
}
