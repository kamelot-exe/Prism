use sqlx::SqlitePool;

use crate::{
    domain::{Category, NewCategory, UpdateCategory},
    error::AppError,
};

pub async fn list_categories(pool: &SqlitePool) -> Result<Vec<Category>, AppError> {
    let categories = sqlx::query_as::<_, Category>(
        r#"SELECT id, name, color_hex, created_at, is_hidden as "is_hidden: bool", sort_order FROM categories
        ORDER BY sort_order ASC, id ASC"#,
    )
    .fetch_all(pool)
    .await?;
    Ok(categories)
}

pub async fn create_category(
    pool: &SqlitePool,
    payload: NewCategory,
) -> Result<Category, AppError> {
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO categories(name, color_hex, is_hidden, sort_order)
        VALUES (?, ?, ?, COALESCE(?, (SELECT IFNULL(MAX(sort_order),0)+1 FROM categories)))
        RETURNING id"#,
    )
    .bind(&payload.name)
    .bind(&payload.color_hex)
    .bind(payload.is_hidden)
    .bind(payload.sort_order)
    .fetch_one(pool)
    .await?;

    get_category(pool, id).await
}

pub async fn get_category(pool: &SqlitePool, id: i64) -> Result<Category, AppError> {
    let category = sqlx::query_as::<_, Category>(
        r#"SELECT id, name, color_hex, created_at, is_hidden as "is_hidden: bool", sort_order FROM categories WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(category)
}

pub async fn update_category(
    pool: &SqlitePool,
    payload: UpdateCategory,
) -> Result<Category, AppError> {
    let existing = get_category(pool, payload.id).await?;
    let name = payload.name.unwrap_or(existing.name);
    let color_hex = payload.color_hex.unwrap_or(existing.color_hex);
    let is_hidden = payload.is_hidden.unwrap_or(existing.is_hidden);
    let sort_order = payload.sort_order.unwrap_or(existing.sort_order);

    sqlx::query(
        "UPDATE categories SET name = ?, color_hex = ?, is_hidden = ?, sort_order = ? WHERE id = ?",
    )
    .bind(name)
    .bind(color_hex)
    .bind(is_hidden)
    .bind(sort_order)
    .bind(payload.id)
    .execute(pool)
    .await?;

    get_category(pool, payload.id).await
}

pub async fn delete_category(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM categories WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
