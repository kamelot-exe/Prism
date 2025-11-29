use tauri::State;

use crate::{
    db::categories_repo,
    db::DbPool,
    domain::{Category, NewCategory, UpdateCategory},
    error::AppError,
};

#[tauri::command]
pub async fn categories_list(pool: State<'_, DbPool>) -> Result<Vec<Category>, AppError> {
    categories_repo::list_categories(&pool).await
}

#[tauri::command]
pub async fn categories_create(
    pool: State<'_, DbPool>,
    payload: NewCategory,
) -> Result<Category, AppError> {
    categories_repo::create_category(&pool, payload).await
}

#[tauri::command]
pub async fn categories_update(
    pool: State<'_, DbPool>,
    payload: UpdateCategory,
) -> Result<Category, AppError> {
    categories_repo::update_category(&pool, payload).await
}

#[tauri::command]
pub async fn categories_delete(pool: State<'_, DbPool>, id: i64) -> Result<(), AppError> {
    categories_repo::delete_category(&pool, id).await
}
