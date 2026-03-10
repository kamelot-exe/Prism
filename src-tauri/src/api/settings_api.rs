use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{db::settings_repo, db::DbPool, error::AppError};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct ProductivitySettings {
    pub pomodoro_focus: u32,
    pub pomodoro_break: u32,
    pub pomodoro_auto_start: bool,
    pub quick_add_duration: u32,
    pub todo_auto_roll: bool,
}

impl Default for ProductivitySettings {
    fn default() -> Self {
        Self {
            pomodoro_focus: 25,
            pomodoro_break: 5,
            pomodoro_auto_start: true,
            quick_add_duration: 60,
            todo_auto_roll: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct AppSettings {
    pub theme: String,
    pub current_theme: String,
    pub first_day_of_week: String,
    pub time_format: String,
    pub user_category_colors: HashMap<String, String>,
    pub productivity: ProductivitySettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "base".to_string(),
            current_theme: "base".to_string(),
            first_day_of_week: "monday".to_string(),
            time_format: "24h".to_string(),
            user_category_colors: HashMap::new(),
            productivity: ProductivitySettings::default(),
        }
    }
}

#[tauri::command]
pub async fn settings_get(pool: State<'_, DbPool>) -> Result<AppSettings, AppError> {
    let stored = settings_repo::get_setting(&pool, "app_settings").await;

    match stored {
        Ok(setting) => serde_json::from_str(&setting.value)
            .map_err(|e| AppError::Other(format!("Failed to parse settings: {}", e))),
        Err(_) => Ok(AppSettings::default()),
    }
}

#[tauri::command]
pub async fn settings_save(
    pool: State<'_, DbPool>,
    settings: AppSettings,
) -> Result<AppSettings, AppError> {
    let serialized = serde_json::to_string(&settings)
        .map_err(|e| AppError::Other(format!("Failed to serialize settings: {}", e)))?;

    settings_repo::upsert_setting(&pool, "app_settings", &serialized).await?;
    Ok(settings)
}
