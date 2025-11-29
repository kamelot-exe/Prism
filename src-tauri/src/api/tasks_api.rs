use chrono::NaiveDate;
use tauri::State;

use crate::{
    db::tasks_repo,
    db::DbPool,
    domain::{NewTask, Task, UpdateTask},
    error::AppError,
};

#[tauri::command]
pub async fn tasks_list(
    pool: State<'_, DbPool>,
    date: Option<NaiveDate>,
) -> Result<Vec<Task>, AppError> {
    tasks_repo::list_tasks(&pool, date).await
}

#[tauri::command]
pub async fn tasks_create(pool: State<'_, DbPool>, payload: NewTask) -> Result<Task, AppError> {
    tasks_repo::create_task(&pool, payload).await
}

#[tauri::command]
pub async fn tasks_update(pool: State<'_, DbPool>, payload: UpdateTask) -> Result<Task, AppError> {
    tasks_repo::update_task(&pool, payload).await
}

#[tauri::command]
pub async fn tasks_delete(pool: State<'_, DbPool>, id: i64) -> Result<(), AppError> {
    tasks_repo::delete_task(&pool, id).await
}
