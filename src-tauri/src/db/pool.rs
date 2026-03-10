use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tauri::{Emitter, Manager};

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

    sqlx::query("PRAGMA journal_mode=WAL;").execute(&pool).await?;
    sqlx::query("PRAGMA synchronous=NORMAL;").execute(&pool).await?;
    sqlx::query("PRAGMA foreign_keys=ON;").execute(&pool).await?;

    if let Err(error) = migrations::run_migrations(&pool).await {
        pool.close().await;
        drop(pool);

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let backup_path = app_data.join(format!("prism_calendar_{timestamp}.bak"));

        if db_path.exists() {
            std::fs::rename(&db_path, &backup_path).map_err(|rename_error| {
                AppError::Config(format!(
                    "Database migration failed ({error}). Backup creation also failed: {rename_error}"
                ))
            })?;
        }

        let backup_path_string = backup_path.display().to_string();
        let _ = app.emit("migration-failed", backup_path_string.clone());

        return Err(AppError::Config(format!(
            "Database migration failed: {error}. Existing data was backed up to {backup_path_string}"
        )));
    }

    Ok(pool)
}
