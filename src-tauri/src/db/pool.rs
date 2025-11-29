use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tauri::Manager;

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

    // Run migrations - if they fail due to schema mismatch, delete and recreate
    if let Err(_e) = migrations::run_migrations(&pool).await {
        // If migration fails, it might be due to old schema - close pool and delete
        pool.close().await;
        drop(pool);
        
        // Wait a bit to ensure file handles are released
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        if db_path.exists() {
            // Try multiple times in case file is still locked
            let mut attempts = 0;
            while attempts < 5 {
                match std::fs::remove_file(&db_path) {
                    Ok(_) => break,
                    Err(e) if attempts == 4 => {
                        return Err(AppError::Config(format!("Failed to remove old database after multiple attempts: {e}")));
                    }
                    Err(_) => {
                        attempts += 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                    }
                }
            }
        }
        
        // Recreate the pool and run migrations again
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(&database_url)
            .await?;
        
        migrations::run_migrations(&pool).await?;
        Ok(pool)
    } else {
        Ok(pool)
    }
}
