use tauri::State;

use crate::{db::settings_repo, db::DbPool, domain::Setting, error::AppError};

#[tauri::command]
pub async fn settings_list(pool: State<'_, DbPool>) -> Result<Vec<Setting>, AppError> {
    settings_repo::list_settings(&pool).await
}

#[tauri::command]
pub async fn settings_put(
    pool: State<'_, DbPool>,
    key: String,
    value: String,
) -> Result<Setting, AppError> {
    settings_repo::upsert_setting(&pool, &key, &value).await
}
