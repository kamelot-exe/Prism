use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Event {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub start_ts: DateTime<Utc>,
    pub end_ts: DateTime<Utc>,
    pub category_id: Option<i64>,
    pub all_day: bool,
    pub recurrence_rule: Option<String>,
    pub reminder_minutes: Option<i32>,
    pub source: Option<String>,
    pub external_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewEvent {
    pub title: String,
    pub description: Option<String>,
    pub start_ts: DateTime<Utc>,
    pub end_ts: DateTime<Utc>,
    pub category_id: Option<i64>,
    pub all_day: bool,
    pub recurrence_rule: Option<String>,
    pub reminder_minutes: Option<i32>,
    pub source: Option<String>,
    pub external_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateEvent {
    pub id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_ts: Option<DateTime<Utc>>,
    pub end_ts: Option<DateTime<Utc>>,
    pub category_id: Option<i64>,
    pub all_day: Option<bool>,
    pub recurrence_rule: Option<String>,
    pub reminder_minutes: Option<i32>,
}
