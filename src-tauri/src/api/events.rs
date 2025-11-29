use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::db::get_pool;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub category_id: Option<i64>,
    pub all_day: i32,
    pub source: Option<String>,
    pub external_id: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub category_id: Option<i64>,
    pub all_day: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateEventRequest {
    pub id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub category_id: Option<i64>,
    pub all_day: Option<bool>,
}

#[tauri::command]
pub async fn get_events(
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<Event>, String> {
    let pool = get_pool().map_err(|e| e.to_string())?;

    let query = if let (Some(start), Some(end)) = (start_date, end_date) {
        sqlx::query_as::<_, Event>(
            r#"
            SELECT id, title, description, start_time, end_time, category_id, all_day, source, external_id, created_at, updated_at
            FROM events
            WHERE start_time >= ? AND end_time <= ?
            ORDER BY start_time ASC
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&pool)
        .await
    } else {
        sqlx::query_as::<_, Event>(
            r#"
            SELECT id, title, description, start_time, end_time, category_id, all_day, source, external_id, created_at, updated_at
            FROM events
            ORDER BY start_time ASC
            "#,
        )
        .fetch_all(&pool)
        .await
    };

    query.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_event(request: CreateEventRequest) -> Result<Event, String> {
    let pool = get_pool().map_err(|e| e.to_string())?;

    let all_day = if request.all_day { 1 } else { 0 };

    let id = sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO events (title, description, start_time, end_time, category_id, all_day)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
        "#,
    )
    .bind(&request.title)
    .bind(&request.description)
    .bind(&request.start_time)
    .bind(&request.end_time)
    .bind(&request.category_id)
    .bind(all_day)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let event = sqlx::query_as::<_, Event>(
        r#"
        SELECT id, title, description, start_time, end_time, category_id, all_day, source, external_id, created_at, updated_at
        FROM events
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(event)
}

#[tauri::command]
pub async fn update_event(request: UpdateEventRequest) -> Result<Event, String> {
    let pool = get_pool().map_err(|e| e.to_string())?;

    // Build dynamic update query
    let mut updates = Vec::new();
    if request.title.is_some() {
        updates.push("title = ?");
    }
    if request.description.is_some() {
        updates.push("description = ?");
    }
    if request.start_time.is_some() {
        updates.push("start_time = ?");
    }
    if request.end_time.is_some() {
        updates.push("end_time = ?");
    }
    if request.category_id.is_some() {
        updates.push("category_id = ?");
    }
    if request.all_day.is_some() {
        updates.push("all_day = ?");
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    let query = format!(
        "UPDATE events SET {} WHERE id = ?",
        updates.join(", ")
    );

    let mut query_builder = sqlx::query(&query);
    
    if let Some(ref title) = request.title {
        query_builder = query_builder.bind(title);
    }
    if let Some(ref description) = request.description {
        query_builder = query_builder.bind(description);
    }
    if let Some(ref start_time) = request.start_time {
        query_builder = query_builder.bind(start_time);
    }
    if let Some(ref end_time) = request.end_time {
        query_builder = query_builder.bind(end_time);
    }
    if let Some(category_id) = request.category_id {
        query_builder = query_builder.bind(category_id);
    }
    if let Some(all_day) = request.all_day {
        query_builder = query_builder.bind(if all_day { 1 } else { 0 });
    }
    query_builder = query_builder.bind(request.id);

    query_builder.execute(&pool).await.map_err(|e| e.to_string())?;

    let event = sqlx::query_as::<_, Event>(
        r#"
        SELECT id, title, description, start_time, end_time, category_id, all_day, source, external_id, created_at, updated_at
        FROM events
        WHERE id = ?
        "#,
    )
    .bind(request.id)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(event)
}

#[tauri::command]
pub async fn delete_event(id: i64) -> Result<(), String> {
    let pool = get_pool().map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM events WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

