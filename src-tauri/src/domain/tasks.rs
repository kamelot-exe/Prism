use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewTask {
    pub title: String,
    pub date: Option<NaiveDate>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateTask {
    pub id: i64,
    pub title: Option<String>,
    pub done: Option<bool>,
    pub date: Option<NaiveDate>,
}
