use sqlx::SqlitePool;

use crate::{
    domain::{NewRecurrenceException, RecurrenceException},
    error::AppError,
};

pub async fn create_recurrence_exception(
    pool: &SqlitePool,
    payload: NewRecurrenceException,
) -> Result<RecurrenceException, AppError> {
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO recurrence_exceptions(event_id, occurrence_date, action, new_start_ts, new_end_ts)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(event_id, occurrence_date)
           DO UPDATE SET action = excluded.action, new_start_ts = excluded.new_start_ts, new_end_ts = excluded.new_end_ts
           RETURNING id"#,
    )
    .bind(payload.event_id)
    .bind(payload.occurrence_date)
    .bind(&payload.action)
    .bind(&payload.new_start_ts)
    .bind(&payload.new_end_ts)
    .fetch_one(pool)
    .await?;

    get_recurrence_exception(pool, id).await
}

pub async fn get_recurrence_exception(
    pool: &SqlitePool,
    id: i64,
) -> Result<RecurrenceException, AppError> {
    let exception = sqlx::query_as::<_, RecurrenceException>(
        r#"SELECT id, event_id, occurrence_date, action, new_start_ts, new_end_ts
           FROM recurrence_exceptions WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(exception)
}

pub async fn list_recurrence_exceptions(
    pool: &SqlitePool,
    event_id: Option<i64>,
) -> Result<Vec<RecurrenceException>, AppError> {
    let exceptions = if let Some(target_event_id) = event_id {
        sqlx::query_as::<_, RecurrenceException>(
            r#"SELECT id, event_id, occurrence_date, action, new_start_ts, new_end_ts
               FROM recurrence_exceptions
               WHERE event_id = ?
               ORDER BY occurrence_date ASC"#,
        )
        .bind(target_event_id)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, RecurrenceException>(
            r#"SELECT id, event_id, occurrence_date, action, new_start_ts, new_end_ts
               FROM recurrence_exceptions
               ORDER BY occurrence_date ASC"#,
        )
        .fetch_all(pool)
        .await?
    };

    Ok(exceptions)
}
