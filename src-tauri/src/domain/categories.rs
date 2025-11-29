use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub color_hex: String,
    pub created_at: DateTime<Utc>,
    pub is_hidden: bool,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewCategory {
    pub name: String,
    pub color_hex: String,
    pub is_hidden: bool,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateCategory {
    pub id: i64,
    pub name: Option<String>,
    pub color_hex: Option<String>,
    pub is_hidden: Option<bool>,
    pub sort_order: Option<i64>,
}
