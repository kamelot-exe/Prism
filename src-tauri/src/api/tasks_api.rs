use chrono::NaiveDate;
use serde::Serialize;
use tauri::State;

use crate::{
    db::tasks_repo,
    db::DbPool,
    domain::{NewTask, Task, UpdateTask, parse_task_text},
    error::AppError,
};

#[derive(Serialize)]
pub struct ToggleTaskResponse {
    pub task: Task,
    pub next_task: Option<Task>,
}

/// Normalize priority to a valid value, defaulting to "normal"
fn normalize_priority(p: Option<String>) -> String {
    match p.as_deref() {
        Some("low") | Some("normal") | Some("high") | Some("urgent") => p.unwrap(),
        Some("medium") => "normal".into(), // Migrate old "medium" to "normal"
        _ => "normal".into(),
    }
}

#[tauri::command]
pub async fn tasks_list(
    pool: State<'_, DbPool>,
    date: Option<NaiveDate>,
) -> Result<Vec<Task>, AppError> {
    tasks_repo::list_tasks(&pool, date).await
}

#[tauri::command]
pub async fn tasks_create(pool: State<'_, DbPool>, mut payload: NewTask) -> Result<Task, AppError> {
    // Normalize priority
    payload.priority = Some(normalize_priority(payload.priority));
    tasks_repo::create_task(&pool, payload).await
}

#[tauri::command]
pub async fn tasks_update(pool: State<'_, DbPool>, mut payload: UpdateTask) -> Result<Task, AppError> {
    // Normalize priority if provided
    if let Some(priority) = payload.priority {
        payload.priority = Some(normalize_priority(Some(priority)));
    }
    tasks_repo::update_task(&pool, payload).await
}

#[tauri::command]
pub async fn tasks_delete(pool: State<'_, DbPool>, id: i64) -> Result<(), AppError> {
    tasks_repo::delete_task(&pool, id).await
}

#[tauri::command]
pub async fn tasks_toggle_done(
    pool: State<'_, DbPool>,
    id: i64,
    done: Option<bool>,
) -> Result<ToggleTaskResponse, AppError> {
    let (task, next_task) = tasks_repo::toggle_task_done(&pool, id, done).await?;
    Ok(ToggleTaskResponse { task, next_task })
}

#[tauri::command]
pub async fn task_parse_create(
    pool: State<'_, DbPool>,
    text: String,
) -> Result<Task, AppError> {
    // Parse the text
    let parsed = parse_task_text(&text);
    
    // Create NewTask from parsed data
                    let new_task = NewTask {
                        title: parsed.title,
                        date: parsed.date,
                        priority: Some(normalize_priority(parsed.priority)),
                        recurrence: parsed.recurrence,
                        estimated_minutes: None,
                        is_focus: None,
                    };
    
    // Create task via repo
    tasks_repo::create_task(&pool, new_task).await
}
