use sqlx::SqlitePool;

use crate::{domain::Setting, error::AppError};

pub async fn list_settings(pool: &SqlitePool) -> Result<Vec<Setting>, AppError> {
    let settings = sqlx::query_as::<_, Setting>("SELECT key, value FROM settings")
        .fetch_all(pool)
        .await?;
    Ok(settings)
}

pub async fn upsert_setting(
    pool: &SqlitePool,
    key: &str,
    value: &str,
) -> Result<Setting, AppError> {
    sqlx::query(
        "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;

    get_setting(pool, key).await
}

pub async fn get_setting(pool: &SqlitePool, key: &str) -> Result<Setting, AppError> {
    let setting = sqlx::query_as::<_, Setting>("SELECT key, value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_one(pool)
        .await?;
    Ok(setting)
}
