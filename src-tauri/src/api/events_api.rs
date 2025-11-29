use chrono::{DateTime, Utc};
use tauri::State;

use crate::{
    db::events_repo,
    db::DbPool,
    domain::{Event, NewEvent, UpdateEvent},
    error::AppError,
};

#[tauri::command]
pub async fn events_list(
    pool: State<'_, DbPool>,
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
) -> Result<Vec<Event>, AppError> {
    events_repo::list_events(&pool, start, end).await
}

#[tauri::command]
pub async fn events_create(pool: State<'_, DbPool>, payload: NewEvent) -> Result<Event, AppError> {
    events_repo::create_event(&pool, payload).await
}

#[tauri::command]
pub async fn events_update(
    pool: State<'_, DbPool>,
    payload: UpdateEvent,
) -> Result<Event, AppError> {
    events_repo::update_event(&pool, payload).await
}

#[tauri::command]
pub async fn events_delete(pool: State<'_, DbPool>, id: i64) -> Result<(), AppError> {
    events_repo::delete_event(&pool, id).await
}
