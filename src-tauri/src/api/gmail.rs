use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::sync::OnceLock;
use axum::{
    extract::Query,
    response::Html,
    routing::get,
    Router,
};
use std::collections::HashMap;
use tokio::sync::oneshot;

use crate::gmail::{GmailClient, TokenInfo};

// Channel for passing OAuth code from callback to main thread
static OAUTH_CODE_SENDER: OnceLock<Mutex<Option<oneshot::Sender<String>>>> = OnceLock::new();

// Store Gmail client in app state
// Client ID and Secret should be configured via environment variables or settings
// For production, these should be stored securely
static GMAIL_CLIENT: OnceLock<Mutex<Option<Arc<GmailClient>>>> = OnceLock::new();

async fn get_gmail_client() -> Result<Arc<GmailClient>, String> {
    let client_mutex = GMAIL_CLIENT.get_or_init(|| Mutex::new(None));
    let mut client = client_mutex.lock().await;
    
    if let Some(ref c) = *client {
        return Ok(c.clone());
    }

    // Get credentials from environment or use defaults for development
    // In production, these should be stored securely
    let client_id = std::env::var("GOOGLE_CLIENT_ID")
        .unwrap_or_else(|_| "YOUR_CLIENT_ID".to_string());
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET")
        .unwrap_or_else(|_| "YOUR_CLIENT_SECRET".to_string());
    
    // Use localhost redirect for desktop app
    let redirect_url = "http://localhost:8080/oauth/callback".to_string();

    let gmail_client = GmailClient::new(client_id, client_secret, redirect_url)
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

async fn oauth_callback_handler(
    Query(params): Query<HashMap<String, String>>,
) -> Html<String> {
    if let Some(code) = params.get("code") {
        // Send code to main thread via channel
        if let Some(sender_mutex) = OAUTH_CODE_SENDER.get() {
            if let Ok(mut sender_opt) = sender_mutex.try_lock() {
                if let Some(sender) = sender_opt.take() {
                    let _ = sender.send(code.clone());
                }
            }
        }
        
        // Success - show success page
        Html(
            r#"
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Successful</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .success { color: green; font-size: 24px; }
                </style>
            </head>
            <body>
                <div class="success">✓ Authorization successful! You can close this window.</div>
                <script>
                    setTimeout(() => window.close(), 2000);
                </script>
            </body>
            </html>
            "#
            .to_string(),
        )
    } else if let Some(error) = params.get("error") {
        // Error - show error page
        Html(format!(
            r#"
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Failed</title>
                <style>
                    body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; }}
                    .error {{ color: red; font-size: 24px; }}
                </style>
            </head>
            <body>
                <div class="error">✗ Authorization failed: {}</div>
            </body>
            </html>
            "#,
            error
        ))
    } else {
        Html(
            r#"
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization</title>
            </head>
            <body>
                <p>No authorization code received.</p>
            </body>
            </html>
            "#
            .to_string(),
        )
    }
}

#[tauri::command]
pub async fn gmail_get_auth_url() -> Result<AuthUrlResponse, String> {
    let client = get_gmail_client().await?;
    let (url, state) = client
        .get_authorization_url()
        .map_err(|e| format!("Failed to get authorization URL: {}", e))?;

    // Start local HTTP server for OAuth callback
    tokio::spawn(async move {
        let app = Router::new()
            .route("/oauth/callback", get(oauth_callback_handler));

        let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
            .await;
        
        if let Ok(listener) = listener {
            let _ = axum::serve(listener, app).await;
        }
    });

    // Open browser with authorization URL
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("cmd")
            .args(["/C", "start", &url.to_string()])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&url.to_string())
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&url.to_string())
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }

    Ok(AuthUrlResponse {
        url: url.to_string(),
        state,
    })
}

#[tauri::command]
pub async fn gmail_wait_for_callback() -> Result<String, String> {
    // Create channel for receiving OAuth code
    let (tx, rx) = oneshot::channel::<String>();
    
    let sender_mutex = OAUTH_CODE_SENDER.get_or_init(|| Mutex::new(None));
    let mut sender_opt = sender_mutex.lock().await;
    *sender_opt = Some(tx);
    drop(sender_opt);

    // Wait for code with timeout (30 seconds)
    tokio::select! {
        result = rx => {
            result.map_err(|e| format!("Failed to receive OAuth code: {}", e))
        }
        _ = tokio::time::sleep(tokio::time::Duration::from_secs(30)) => {
            Err("Timeout waiting for OAuth callback".to_string())
        }
    }
}

#[tauri::command]
pub async fn gmail_exchange_code(code: String) -> Result<TokenInfo, String> {
    let client = get_gmail_client().await?;
    client
        .exchange_code(code)
        .await
        .map_err(|e| format!("Failed to exchange code: {}", e))
}

#[tauri::command]
pub async fn sync_gmail(
    time_min: Option<String>,
    time_max: Option<String>,
) -> Result<usize, String> {
    let client = get_gmail_client().await?;

    let time_min_parsed = time_min
        .map(|s| DateTime::parse_from_rfc3339(&s))
        .transpose()
        .map_err(|e| format!("Invalid time_min format: {}", e))?
        .map(|dt| dt.with_timezone(&Utc));

    let time_max_parsed = time_max
        .map(|s| DateTime::parse_from_rfc3339(&s))
        .transpose()
        .map_err(|e| format!("Invalid time_max format: {}", e))?
        .map(|dt| dt.with_timezone(&Utc));

    let count = client
        .sync_to_database(time_min_parsed, time_max_parsed)
        .await
        .map_err(|e| format!("Failed to sync Gmail events: {}", e))?;

    Ok(count)
}

#[tauri::command]
pub async fn gmail_disconnect() -> Result<(), String> {
    let client = get_gmail_client().await?;
    client
        .clear_tokens()
        .await
        .map_err(|e| format!("Failed to disconnect: {}", e))
}

