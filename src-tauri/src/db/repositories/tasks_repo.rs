use sqlx::SqlitePool;

use crate::{
    domain::{NewTask, Task, UpdateTask},
    error::AppError,
};

pub async fn list_tasks(
    pool: &SqlitePool,
    date: Option<chrono::NaiveDate>,
) -> Result<Vec<Task>, AppError> {
    let tasks = if let Some(d) = date {
        sqlx::query_as::<_, Task>(
            r#"SELECT id, title, done as "done: bool", date, created_at FROM tasks WHERE date = ? ORDER BY created_at DESC"#,
        )
        .bind(d)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Task>(
            r#"SELECT id, title, done as "done: bool", date, created_at FROM tasks ORDER BY created_at DESC"#,
        )
        .fetch_all(pool)
        .await?
    };
    Ok(tasks)
}

pub async fn create_task(pool: &SqlitePool, payload: NewTask) -> Result<Task, AppError> {
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO tasks(title, done, date) VALUES (?, 0, ?) RETURNING id"#,
    )
    .bind(&payload.title)
    .bind(payload.date)
    .fetch_one(pool)
    .await?;

    get_task(pool, id).await
}

pub async fn get_task(pool: &SqlitePool, id: i64) -> Result<Task, AppError> {
    let task = sqlx::query_as::<_, Task>(
        r#"SELECT id, title, done as "done: bool", date, created_at FROM tasks WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(task)
}

pub async fn update_task(pool: &SqlitePool, payload: UpdateTask) -> Result<Task, AppError> {
    let existing = get_task(pool, payload.id).await?;
    let title = payload.title.unwrap_or(existing.title);
    let done = payload.done.unwrap_or(existing.done);
    let date = payload.date.or(existing.date);

    sqlx::query("UPDATE tasks SET title = ?, done = ?, date = ? WHERE id = ?")
        .bind(title)
        .bind(done)
        .bind(date)
        .bind(payload.id)
        .execute(pool)
        .await?;

    get_task(pool, payload.id).await
}

pub async fn delete_task(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
