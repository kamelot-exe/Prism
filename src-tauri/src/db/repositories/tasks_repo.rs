use sqlx::{SqlitePool, Row};
use serde_json;

use crate::{
    domain::{NewTask, Task, UpdateTask, Recurrence},
    error::AppError,
};

// Helper to deserialize recurrence from JSON string
fn deserialize_recurrence(json_str: Option<String>) -> Option<Recurrence> {
    json_str.and_then(|s| {
        if s.is_empty() {
            None
        } else {
            serde_json::from_str(&s).ok()
        }
    })
}

// Helper to serialize recurrence to JSON string
fn serialize_recurrence(recurrence: &Option<Recurrence>) -> Option<String> {
    recurrence.as_ref().and_then(|r| serde_json::to_string(r).ok())
}

// Helper to map a row to Task
fn map_row_to_task(
    row: sqlx::sqlite::SqliteRow,
) -> Result<Task, sqlx::Error> {
    let id: i64 = row.get(0);
    let title: String = row.get(1);
    let done: bool = row.get(2);
    let date: Option<chrono::NaiveDate> = row.get(3);
    let priority: Option<String> = row.get(4);
    let recurrence_json: Option<String> = row.get(5);
    let estimated_minutes: Option<i64> = row.get(6);
    let is_focus: bool = row.get(7);
    let created_at: chrono::DateTime<chrono::Utc> = row.get(8);
    
    let recurrence = deserialize_recurrence(recurrence_json);
    let priority = priority.unwrap_or_else(|| "normal".to_string());
    
    Ok(Task {
        id,
        title,
        done,
        date,
        priority,
        recurrence,
        estimated_minutes,
        is_focus,
        created_at,
    })
}

pub async fn list_tasks(
    pool: &SqlitePool,
    date: Option<chrono::NaiveDate>,
) -> Result<Vec<Task>, AppError> {
    let tasks = if let Some(d) = date {
        let rows = sqlx::query(
            r#"SELECT id, title, done as "done: bool", date, priority, recurrence, estimated_minutes, is_focus, created_at FROM tasks WHERE date = ? ORDER BY created_at DESC"#,
        )
        .bind(d)
        .fetch_all(pool)
        .await?;
        
        let mut result = Vec::new();
        for row in rows {
            result.push(map_row_to_task(row)?);
        }
        result
    } else {
        let rows = sqlx::query(
            r#"SELECT id, title, done as "done: bool", date, priority, recurrence, estimated_minutes, is_focus, created_at FROM tasks ORDER BY created_at DESC"#,
        )
        .fetch_all(pool)
        .await?;
        
        let mut result = Vec::new();
        for row in rows {
            result.push(map_row_to_task(row)?);
        }
        result
    };
    Ok(tasks)
}

pub async fn create_task(pool: &SqlitePool, payload: NewTask) -> Result<Task, AppError> {
    let recurrence_json = serialize_recurrence(&payload.recurrence);
    let priority = payload.priority.unwrap_or_else(|| "normal".to_string());
    let is_focus = payload.is_focus.unwrap_or(false);
    
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO tasks(title, done, date, priority, recurrence, estimated_minutes, is_focus) VALUES (?, 0, ?, ?, ?, ?, ?) RETURNING id"#,
    )
    .bind(&payload.title)
    .bind(payload.date)
    .bind(&priority)
    .bind(recurrence_json)
    .bind(payload.estimated_minutes)
    .bind(is_focus)
    .fetch_one(pool)
    .await?;

    get_task(pool, id).await
}

pub async fn get_task(pool: &SqlitePool, id: i64) -> Result<Task, AppError> {
    let row = sqlx::query(
        r#"SELECT id, title, done as "done: bool", date, priority, recurrence, estimated_minutes, is_focus, created_at FROM tasks WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    
    map_row_to_task(row).map_err(|e| AppError::Database(e.to_string()))
}

pub async fn update_task(pool: &SqlitePool, payload: UpdateTask) -> Result<Task, AppError> {
    let existing = get_task(pool, payload.id).await?;
    let title = payload.title.unwrap_or(existing.title);
    let done = payload.done.unwrap_or(existing.done);
    let date = payload.date.or(existing.date);
    let priority = payload.priority.unwrap_or(existing.priority);
    let recurrence = payload.recurrence.or(existing.recurrence);
    let estimated_minutes = payload.estimated_minutes.or(existing.estimated_minutes);
    let is_focus = payload.is_focus.unwrap_or(existing.is_focus);
    let recurrence_json = serialize_recurrence(&recurrence);

    sqlx::query("UPDATE tasks SET title = ?, done = ?, date = ?, priority = ?, recurrence = ?, estimated_minutes = ?, is_focus = ? WHERE id = ?")
        .bind(title)
        .bind(done)
        .bind(date)
        .bind(&priority)
        .bind(recurrence_json)
        .bind(estimated_minutes)
        .bind(is_focus)
        .bind(payload.id)
        .execute(pool)
        .await?;

    get_task(pool, payload.id).await
}

pub async fn delete_task(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn toggle_task_done(
    pool: &SqlitePool,
    id: i64,
    desired_state: Option<bool>,
) -> Result<(Task, Option<Task>), AppError> {
    let existing = get_task(pool, id).await?;
    let new_state = desired_state.unwrap_or(!existing.done);

    sqlx::query("UPDATE tasks SET done = ? WHERE id = ?")
        .bind(new_state)
        .bind(id)
        .execute(pool)
        .await?;

    let updated = get_task(pool, id).await?;
    
    // Generate next occurrence if task is marked done and has recurrence
    let next_task = if new_state && updated.recurrence.is_some() && updated.date.is_some() {
        if let Some(recurrence) = &updated.recurrence {
            if let Some(current_date) = updated.date {
                if let Some(next_date) = crate::domain::recurrence::next_occurrence(&current_date, recurrence) {
                    let new_task = NewTask {
                        title: updated.title.clone(),
                        date: Some(next_date),
                        priority: Some(updated.priority.clone()),
                        recurrence: Some(recurrence.clone()),
                        estimated_minutes: updated.estimated_minutes,
                        is_focus: Some(updated.is_focus),
                    };
                    create_task(pool, new_task).await.ok()
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    Ok((updated, next_task))
}

pub async fn list_tasks_range(
    pool: &SqlitePool,
    start: Option<chrono::NaiveDate>,
    end: Option<chrono::NaiveDate>,
) -> Result<Vec<Task>, AppError> {
    let rows = sqlx::query(
        r#"SELECT id, title, done as "done: bool", date, priority, recurrence, estimated_minutes, is_focus, created_at
           FROM tasks
           WHERE date IS NOT NULL
             AND (? IS NULL OR date >= ?)
             AND (? IS NULL OR date <= ?)
           ORDER BY date ASC, created_at DESC"#,
    )
    .bind(start)
    .bind(start)
    .bind(end)
    .bind(end)
    .fetch_all(pool)
    .await?;

    let mut result = Vec::new();
    for row in rows {
        result.push(map_row_to_task(row)?);
    }

    Ok(result)
}
