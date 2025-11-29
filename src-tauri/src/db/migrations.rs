use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::migrate!("../../migrations").run(pool).await?;
    Ok(())
}
