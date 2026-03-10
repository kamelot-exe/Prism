use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use super::recurrence::Recurrence;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub date: Option<NaiveDate>,
    pub priority: String, // "low" | "normal" | "high" | "urgent"
    pub recurrence: Option<Recurrence>,
    pub estimated_minutes: Option<i64>,
    pub is_focus: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewTask {
    pub title: String,
    pub date: Option<NaiveDate>,
    pub priority: Option<String>,
    pub recurrence: Option<Recurrence>,
    pub estimated_minutes: Option<i64>,
    pub is_focus: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateTask {
    pub id: i64,
    pub title: Option<String>,
    pub done: Option<bool>,
    pub date: Option<NaiveDate>,
    pub priority: Option<String>,
    pub recurrence: Option<Recurrence>,
    pub estimated_minutes: Option<i64>,
    pub is_focus: Option<bool>,
}
