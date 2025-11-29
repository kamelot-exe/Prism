use crate::error::AppError;
use sqlx::{migrate::Migrator, SqlitePool};
use std::path::Path;

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    let migrations_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    let migrator = Migrator::new(migrations_path).await?;
    migrator.run(pool).await?;
    Ok(())
}
