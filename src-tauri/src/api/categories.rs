use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::db::get_pool;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Category {
    pub id: Option<i64>,
    pub name: String,
    pub color: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub color: Option<String>,
}

#[tauri::command]
pub async fn list_categories() -> Result<Vec<Category>, String> {
    let pool = get_pool().map_err(|e| e.to_string())?;

    let categories = sqlx::query_as::<_, Category>(
        r#"
        SELECT id, name, color, created_at
        FROM categories
        ORDER BY name ASC
        "#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(categories)
}

#[tauri::command]
pub async fn create_category(request: CreateCategoryRequest) -> Result<Category, String> {
    let pool = get_pool().map_err(|e| e.to_string())?;

    let color = request.color.unwrap_or_else(|| "#3b82f6".to_string());

    let id = sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO categories (name, color)
        VALUES (?, ?)
        RETURNING id
        "#,
    )
    .bind(&request.name)
    .bind(&color)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let category = sqlx::query_as::<_, Category>(
        r#"
        SELECT id, name, color, created_at
        FROM categories
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(category)
}

