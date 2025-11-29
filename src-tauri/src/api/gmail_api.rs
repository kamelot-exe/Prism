use axum::{extract::Query, response::Html, routing::get, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::OnceLock;
use tokio::sync::oneshot;
use tokio::sync::Mutex;
use tauri::State;

use crate::{db::DbPool, gmail::{GmailClient, TokenInfo}};

// Channel for passing OAuth code from callback to main thread
static OAUTH_CODE_SENDER: OnceLock<Mutex<Option<oneshot::Sender<String>>>> = OnceLock::new();

// Store Gmail client in app state
static GMAIL_CLIENT: OnceLock<Mutex<Option<Arc<GmailClient>>>> = OnceLock::new();

async fn get_gmail_client(pool: &DbPool) -> Result<Arc<GmailClient>, String> {
    let client_mutex = GMAIL_CLIENT.get_or_init(|| Mutex::new(None));
    let mut client = client_mutex.lock().await;

    if let Some(ref c) = *client {
        return Ok(c.clone());
    }

    let client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_else(|_| "YOUR_CLIENT_ID".to_string());
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_else(|_| "YOUR_CLIENT_SECRET".to_string());
    let redirect_url = "http://localhost:8080/oauth/callback".to_string();

    let gmail_client = GmailClient::new(client_id, client_secret, redirect_url, pool.clone())
        .map_err(|e| format!("Failed to create Gmail client: {}", e))?;

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
            r#"<!DOCTYPE html><html><head><title>Authorization Successful</title><style>body { font-family: Arial, sans-serif; text-align: center; padding: 50px; } .success { color: green; font-size: 24px; }</style></head><body><div class="success">✓ Authorization successful! You can close this window.</div><script>setTimeout(() => window.close(), 2000);</script></body></html>"#.to_string(),
        )
    } else if let Some(error) = params.get("error") {
        Html(format!(
            r#"<!DOCTYPE html><html><head><title>Authorization Failed</title><style>body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; }} .error {{ color: red; font-size: 24px; }}</style></head><body><div class="error">✗ Authorization failed: {}</div></body></html>"#,
            error
        ))
    } else {
        Html(
            r#"<!DOCTYPE html><html><head><title>Authorization</title></head><body><p>No authorization code received.</p></body></html>"#
                .to_string(),
        )
    }
}

#[tauri::command]
pub async fn gmail_get_auth_url(pool: State<'_, DbPool>) -> Result<AuthUrlResponse, String> {
    let client = get_gmail_client(&pool).await?;
    let (url, state) = client
        .get_authorization_url()
        .map_err(|e| format!("Failed to get authorization URL: {}", e))?;

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
pub async fn gmail_wait_for_callback() -> Result<String, String> {
    let (tx, rx) = oneshot::channel::<String>();

    let sender_mutex = OAUTH_CODE_SENDER.get_or_init(|| Mutex::new(None));
    let mut sender_opt = sender_mutex.lock().await;
    *sender_opt = Some(tx);
    drop(sender_opt);

    tokio::select! {
        result = rx => {
            result.map_err(|e| format!("Failed to receive OAuth code: {}", e))
        }
        _ = tokio::time::sleep(tokio::time::Duration::from_secs(30)) => {
            Err("Timed out waiting for OAuth callback".to_string())
        }
    }
}

#[tauri::command]
pub async fn gmail_exchange_code(code: String, state: String, pool: State<'_, DbPool>) -> Result<TokenInfo, String> {
    let client = get_gmail_client(&pool).await?;
    client
        .exchange_code(code, state)
        .await
        .map_err(|e| format!("Failed to exchange code: {}", e))
}

#[tauri::command]
pub async fn sync_gmail(pool: State<'_, DbPool>) -> Result<usize, String> {
    let client = get_gmail_client(&pool).await?;
    client
        .sync_to_database(None, None)
        .await
        .map_err(|e| format!("Failed to sync Gmail: {}", e))
}

#[tauri::command]
pub async fn gmail_disconnect() -> Result<(), String> {
    if let Some(mutex) = GMAIL_CLIENT.get() {
        let mut guard = mutex.lock().await;
        *guard = None;
    }
    Ok(())
}
