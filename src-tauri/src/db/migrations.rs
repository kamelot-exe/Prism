use sqlx::{Pool, Sqlite};

pub async fn run_migrations(pool: &Pool<Sqlite>) -> anyhow::Result<()> {
    // Create migrations table if it doesn't exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Run migrations
    migrate_001_initial_schema(pool).await?;
    migrate_002_add_sync_fields(pool).await?;

    Ok(())
}

async fn migrate_001_initial_schema(pool: &Pool<Sqlite>) -> anyhow::Result<()> {
    let migration_name = "001_initial_schema";
    
    // Check if migration already applied
    let exists: Option<i64> = sqlx::query_scalar(
        "SELECT 1 FROM migrations WHERE name = ?"
    )
    .bind(migration_name)
    .fetch_optional(pool)
    .await?;

    if exists.is_some() {
        return Ok(());
    }

    // Create categories table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#3b82f6',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create events table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            category_id INTEGER,
            all_day INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create settings table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Insert default settings
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO settings (key, value) VALUES
        ('theme', 'light'),
        ('first_day_of_week', 'monday'),
        ('time_format', '24h')
        "#,
    )
    .execute(pool)
    .await?;

    // Record migration
    sqlx::query("INSERT INTO migrations (name) VALUES (?)")
        .bind(migration_name)
        .execute(pool)
        .await?;

    Ok(())
}

async fn migrate_002_add_sync_fields(pool: &Pool<Sqlite>) -> anyhow::Result<()> {
    let migration_name = "002_add_sync_fields";
    
    // Check if migration already applied
    let exists: Option<i64> = sqlx::query_scalar(
        "SELECT 1 FROM migrations WHERE name = ?"
    )
    .bind(migration_name)
    .fetch_optional(pool)
    .await?;

    if exists.is_some() {
        return Ok(());
    }

    // Add source and external_id columns to events table if they don't exist
    // SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we check first
    let columns: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM pragma_table_info('events')"
    )
    .fetch_all(pool)
    .await?;

    if !columns.iter().any(|c| c == "source") {
        sqlx::query(
            "ALTER TABLE events ADD COLUMN source TEXT"
        )
        .execute(pool)
        .await?;
    }

    if !columns.iter().any(|c| c == "external_id") {
        sqlx::query(
            "ALTER TABLE events ADD COLUMN external_id TEXT"
        )
        .execute(pool)
        .await?;
    }

    // Create index for faster lookups
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_events_source_external ON events(source, external_id)"
    )
    .execute(pool)
    .await?;

    // Record migration
    sqlx::query("INSERT INTO migrations (name) VALUES (?)")
        .bind(migration_name)
        .execute(pool)
        .await?;

    Ok(())
}

