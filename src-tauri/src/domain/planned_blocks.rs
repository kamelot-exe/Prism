use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct PlannedBlock {
    pub id: i64,
    pub task_id: Option<i64>,
    pub event_id: Option<i64>,
    pub title: String,
    pub start_ts: DateTime<Utc>,
    pub end_ts: DateTime<Utc>,
    pub completed: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewPlannedBlock {
    pub task_id: Option<i64>,
    pub event_id: Option<i64>,
    pub title: String,
    pub start_ts: DateTime<Utc>,
    pub end_ts: DateTime<Utc>,
    pub completed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdatePlannedBlock {
    pub id: i64,
    pub task_id: Option<i64>,
    pub event_id: Option<i64>,
    pub title: Option<String>,
    pub start_ts: Option<DateTime<Utc>>,
    pub end_ts: Option<DateTime<Utc>>,
    pub completed: Option<bool>,
}
