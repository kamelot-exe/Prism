use axum::{extract::Query, response::Html, routing::get, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use tokio::sync::{Mutex, oneshot};
use tauri::State;

use crate::{
    db::DbPool,
    error::AppError,
    gmail::{GmailClient, TokenInfo},
};

// Channel for passing OAuth code from callback to main thread
static OAUTH_CODE_SENDER: OnceLock<Mutex<Option<oneshot::Sender<String>>>> = OnceLock::new();

// Store Gmail client in app state
static GMAIL_CLIENT: OnceLock<Mutex<Option<Arc<GmailClient>>>> = OnceLock::new();

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailStatus {
    pub connected: bool,
    pub last_sync: Option<String>,
    pub email: Option<String>,
}

async fn wait_for_oauth_code(timeout_secs: u64) -> Result<String, AppError> {
    let (tx, rx) = oneshot::channel::<String>();

    let sender_mutex = OAUTH_CODE_SENDER.get_or_init(|| Mutex::new(None));
    let mut sender_opt = sender_mutex.lock().await;
    *sender_opt = Some(tx);
    drop(sender_opt);

    tokio::select! {
        result = rx => {
            result.map_err(|e| AppError::OAuth(format!("Failed to receive OAuth code: {}", e)))
        }
        _ = tokio::time::sleep(tokio::time::Duration::from_secs(timeout_secs)) => {
            Err(AppError::OAuth("Timed out waiting for OAuth callback".to_string()))
        }
    }
}

async fn get_gmail_client(pool: &DbPool) -> Result<Arc<GmailClient>, AppError> {
    let client_mutex = GMAIL_CLIENT.get_or_init(|| Mutex::new(None));
    let mut client = client_mutex.lock().await;

    if let Some(ref c) = *client {
        return Ok(c.clone());
    }

    let client_id = std::env::var("GOOGLE_CLIENT_ID")
        .map_err(|_| AppError::Config("GOOGLE_CLIENT_ID is not set".to_string()))?
        .trim()
        .to_owned();
    if client_id.is_empty() {
        return Err(AppError::Config(
            "GOOGLE_CLIENT_ID is set but empty".to_string(),
        ));
    }

    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET")
        .map_err(|_| AppError::Config("GOOGLE_CLIENT_SECRET is not set".to_string()))?
        .trim()
        .to_owned();
    if client_secret.is_empty() {
        return Err(AppError::Config(
            "GOOGLE_CLIENT_SECRET is set but empty".to_string(),
        ));
    }
    let redirect_url = "http://localhost:8080/oauth/callback".to_string();

    let gmail_client = GmailClient::new(client_id, client_secret, redirect_url, pool.clone())
        .map_err(|e| AppError::OAuth(e.to_string()))?;

    let client_arc = Arc::new(gmail_client);
    *client = Some(client_arc.clone());

    Ok(client_arc)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthUrlResponse {
    pub url: String,
    pub state: String,
}

async fn oauth_callback_handler(Query(params): Query<HashMap<String, String>>) -> Html<String> {
    if let Some(code) = params.get("code") {
        if let Some(sender_mutex) = OAUTH_CODE_SENDER.get() {
            if let Ok(mut sender_opt) = sender_mutex.try_lock() {
                if let Some(sender) = sender_opt.take() {
                    let _ = sender.send(code.clone());
                }
            }
        }

        Html(
            r#"<!DOCTYPE html><html><head><title>Authorization Successful</title><style>body { font-family: Arial, sans-serif; text-align: center; padding: 50px; } .success { color: green; font-size: 24px; }</style></head><body><div class="success">Authorization successful! You can close this window.</div><script>setTimeout(() => window.close(), 2000);</script></body></html>"#.to_string(),
        )
    } else if let Some(error) = params.get("error") {
        Html(format!(
            r#"<!DOCTYPE html><html><head><title>Authorization Failed</title><style>body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; }} .error {{ color: red; font-size: 24px; }}</style></head><body><div class="error">Authorization failed: {}</div></body></html>"#,
            error
        ))
    } else {
        Html(
            r#"<!DOCTYPE html><html><head><title>Authorization</title></head><body><p>No authorization code received.</p></body></html>"#
                .to_string(),
        )
    }
}

fn parse_rfc3339_datetime(
    value: Option<String>,
    label: &str,
) -> Result<Option<DateTime<Utc>>, AppError> {
    value
        .map(|raw| {
            DateTime::parse_from_rfc3339(&raw)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| AppError::Validation(format!("Invalid {} format: {}", label, e)))
        })
        .transpose()
}

#[tauri::command]
pub async fn gmail_get_auth_url(pool: State<'_, DbPool>) -> Result<AuthUrlResponse, AppError> {
    let client = get_gmail_client(&pool).await?;
    let (url, state) = client
        .get_authorization_url()
        .map_err(|e| AppError::OAuth(e.to_string()))?;

    tokio::spawn(async move {
        let app = Router::new().route("/oauth/callback", get(oauth_callback_handler));
        if let Ok(listener) = tokio::net::TcpListener::bind("127.0.0.1:8080").await {
            let _ = axum::serve(listener, app).await;
        }
    });

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("cmd").args(["/C", "start", &url.to_string()]).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("open").arg(&url.to_string()).spawn();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        use std::process::Command;
        let _ = Command::new("xdg-open").arg(&url.to_string()).spawn();
    }

    Ok(AuthUrlResponse {
        url: url.to_string(),
        state,
    })
}

#[tauri::command]
pub async fn gmail_wait_for_callback() -> Result<String, AppError> {
    wait_for_oauth_code(30).await
}

#[tauri::command]
pub async fn gmail_exchange_code(
    code: Option<String>,
    _state: Option<String>,
    pool: State<'_, DbPool>,
) -> Result<TokenInfo, AppError> {
    let auth_code = match code.filter(|c| !c.is_empty()) {
        Some(code) => code,
        None => wait_for_oauth_code(30).await?,
    };

    let client = get_gmail_client(&pool).await?;
    client
        .exchange_code(auth_code)
        .await
        .map_err(|e| AppError::OAuth(format!("Failed to exchange code: {}", e)))
}

#[tauri::command]
pub async fn gmail_sync(
    pool: State<'_, DbPool>,
    perform_sync: Option<bool>,
    time_min: Option<String>,
    time_max: Option<String>,
) -> Result<GmailStatus, AppError> {
    let client = get_gmail_client(&pool).await?;
    let parsed_min = parse_rfc3339_datetime(time_min, "time_min")?;
    let parsed_max = parse_rfc3339_datetime(time_max, "time_max")?;
    if perform_sync.unwrap_or(true) {
        client
            .sync_to_database(parsed_min, parsed_max)
            .await
            .map_err(|e| AppError::Other(format!("Failed to sync Gmail: {}", e)))?;
    }

    let connected = client
        .has_tokens()
        .await
        .map_err(|e| AppError::OAuth(e.to_string()))?;
    let last_sync = client
        .get_last_sync()
        .await
        .map_err(|e| AppError::Other(e.to_string()))?;

    Ok(GmailStatus {
        connected,
        last_sync,
        email: None,
    })
}

#[tauri::command]
pub async fn gmail_status(pool: State<'_, DbPool>) -> Result<GmailStatus, AppError> {
    gmail_sync(pool, Some(false), None, None).await
}

#[tauri::command]
pub async fn gmail_disconnect(pool: State<'_, DbPool>) -> Result<(), AppError> {
    if let Some(mutex) = GMAIL_CLIENT.get() {
        let mut guard = mutex.lock().await;
        if let Some(client) = guard.as_ref() {
            client
                .clear_tokens()
                .await
                .map_err(|e| AppError::OAuth(e.to_string()))?;
        }
        *guard = None;
    } else {
        match get_gmail_client(&pool).await {
            Ok(client) => {
                client
                    .clear_tokens()
                    .await
                    .map_err(|e| AppError::OAuth(e.to_string()))?;
            }
            Err(AppError::Config(_)) => return Ok(()),
            Err(err) => return Err(err),
        }
    }
    Ok(())
}
