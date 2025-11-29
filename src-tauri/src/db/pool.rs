use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use tauri::Manager;

use crate::db::migrations;

static mut DB_POOL: Option<Pool<Sqlite>> = None;

pub async fn init_db(app: &tauri::AppHandle) -> anyhow::Result<()> {
    let app_data = app.path().app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
    
    std::fs::create_dir_all(&app_data)?;
    
    let db_path = app_data.join("prism_calendar.db");
    let database_url = format!("sqlite:{}?mode=rwc", db_path.display());
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    
    // Run migrations
    migrations::run_migrations(&pool).await?;
    
    unsafe {
        DB_POOL = Some(pool);
    }
    
    Ok(())
}

pub fn get_pool() -> anyhow::Result<Pool<Sqlite>> {
    unsafe {
        DB_POOL.as_ref()
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))
    }
}

