use tauri::InvokeError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Configuration error: {0}")]
    Config(String),
    #[error("Not found")]
    NotFound,
    #[error("Invalid input: {0}")]
    Validation(String),
    #[error("OAuth error: {0}")]
    OAuth(String),
    #[error("Unexpected error: {0}")]
    Other(String),
}

impl From<anyhow::Error> for AppError {
    fn from(value: anyhow::Error) -> Self {
        AppError::Other(value.to_string())
    }
}

impl From<AppError> for InvokeError {
    fn from(value: AppError) -> Self {
        InvokeError::from_anyhow(anyhow::anyhow!(value))
    }
}
