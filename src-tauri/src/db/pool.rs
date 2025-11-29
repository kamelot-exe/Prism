use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

use crate::{db::migrations, error::AppError};

pub type DbPool = SqlitePool;

pub async fn create_pool(app: &tauri::AppHandle) -> Result<DbPool, AppError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Config(format!("Failed to get app data directory: {e}")))?;
    std::fs::create_dir_all(&app_data).map_err(|e| AppError::Config(e.to_string()))?;

    let db_path = app_data.join("prism_calendar.db");
    let database_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    migrations::run_migrations(&pool).await?;

    Ok(pool)
}
