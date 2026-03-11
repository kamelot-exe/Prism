use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct RecurrenceException {
    pub id: i64,
    pub event_id: i64,
    pub occurrence_date: NaiveDate,
    pub action: String,
    pub new_start_ts: Option<String>,
    pub new_end_ts: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewRecurrenceException {
    pub event_id: i64,
    pub occurrence_date: NaiveDate,
    pub action: String,
    pub new_start_ts: Option<String>,
    pub new_end_ts: Option<String>,
}
