use serde::{Serialize, Deserialize};
use sqlx::FromRow;

#[derive(Serialize, Deserialize, Debug, Clone, FromRow)]
pub struct PomodoroSession {
    pub id: i64,
    pub task_id: Option<i64>,
    pub kind: String, // "focus" | "break"
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_minutes: i64,
    #[sqlx(rename = "completed")]
    pub completed: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NewPomodoroSession {
    pub task_id: Option<i64>,
    pub kind: String,
    pub started_at: String,
    pub duration_minutes: i64,
    pub completed: bool,
    pub ended_at: Option<String>,
}

