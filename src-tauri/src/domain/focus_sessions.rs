use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct FocusSession {
    pub id: i64,
    pub task_id: Option<i64>,
    pub planned_block_id: Option<i64>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewFocusSession {
    pub task_id: Option<i64>,
    pub planned_block_id: Option<i64>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompleteFocusSession {
    pub id: i64,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i64>,
}
