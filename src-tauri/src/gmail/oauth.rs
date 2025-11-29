use anyhow::{Context, Result};
use oauth2::{
    basic::BasicClient,
    reqwest::async_http_client,
    AuthorizationCode, AuthUrl, ClientId, ClientSecret, RedirectUrl, Scope, TokenResponse,
    TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use url::Url;

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://www.googleapis.com/oauth2/v3/token";
const GOOGLE_SCOPE: &str = "https://www.googleapis.com/auth/calendar.readonly";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub struct OAuthClient {
    client: BasicClient,
    token_store: Arc<Mutex<Option<TokenInfo>>>,
}

impl OAuthClient {
    pub fn new(client_id: String, client_secret: String, redirect_url: String) -> Result<Self> {
        let client = BasicClient::new(
            ClientId::new(client_id),
            Some(ClientSecret::new(client_secret)),
            AuthUrl::new(GOOGLE_AUTH_URL.to_string())?,
            Some(TokenUrl::new(GOOGLE_TOKEN_URL.to_string())?),
        )
        .set_redirect_uri(RedirectUrl::new(redirect_url)?);

        Ok(OAuthClient {
            client,
            token_store: Arc::new(Mutex::new(None)),
        })
    }

    pub fn get_authorization_url(&self) -> Result<(Url, String)> {
        let (auth_url, csrf_token) = self
            .client
            .authorize_url(oauth2::CsrfToken::new_random)
            .add_scope(Scope::new(GOOGLE_SCOPE.to_string()))
            .url();

        Ok((auth_url, csrf_token.secret().clone()))
    }

    pub async fn exchange_code(&self, code: String) -> Result<TokenInfo> {
        let token = self
            .client
            .exchange_code(AuthorizationCode::new(code))
            .request_async(async_http_client)
            .await
            .context("Failed to exchange authorization code")?;

        let expires_at = token
            .expires_in()
            .map(|duration| chrono::Utc::now() + chrono::Duration::seconds(duration.as_secs() as i64));

        let token_info = TokenInfo {
            access_token: token.access_token().secret().clone(),
            refresh_token: token
                .refresh_token()
                .map(|rt| rt.secret().clone())
                .ok_or_else(|| anyhow::anyhow!("No refresh token received"))?,
            expires_at,
        };

        let mut store = self.token_store.lock().await;
        *store = Some(token_info.clone());

        Ok(token_info)
    }

    pub async fn refresh_access_token(&self, refresh_token: &str) -> Result<TokenInfo> {
        let token = self
            .client
            .exchange_refresh_token(&oauth2::RefreshToken::new(refresh_token.to_string()))
            .request_async(async_http_client)
            .await
            .context("Failed to refresh access token")?;

        let expires_at = token
            .expires_in()
            .map(|duration| chrono::Utc::now() + chrono::Duration::seconds(duration.as_secs() as i64));

        let token_info = TokenInfo {
            access_token: token.access_token().secret().clone(),
            refresh_token: refresh_token.to_string(),
            expires_at,
        };

        let mut store = self.token_store.lock().await;
        *store = Some(token_info.clone());

        Ok(token_info)
    }

    pub async fn get_valid_token(&self) -> Result<String> {
        let store = self.token_store.lock().await;
        
        if let Some(ref token_info) = *store {
            // Check if token is still valid (with 5 minute buffer)
            if let Some(expires_at) = token_info.expires_at {
                if expires_at > chrono::Utc::now() + chrono::Duration::minutes(5) {
                    return Ok(token_info.access_token.clone());
                }
            } else {
                // No expiration info, assume it's valid
                return Ok(token_info.access_token.clone());
            }
        }

        drop(store);

        // Token expired or not found, try to refresh
        if let Some(refresh_token) = self.load_refresh_token().await? {
            let token_info = self.refresh_access_token(&refresh_token).await?;
            self.save_refresh_token(&token_info.refresh_token).await?;
            Ok(token_info.access_token)
        } else {
            anyhow::bail!("No refresh token available. Please re-authenticate.");
        }
    }

    pub async fn save_refresh_token(&self, refresh_token: &str) -> Result<()> {
        let keyring = keyring::Entry::new("prism-calendar", "google-refresh-token")
            .context("Failed to create keyring entry")?;
        keyring.set_password(refresh_token)
            .context("Failed to save refresh token")?;
        Ok(())
    }

    pub async fn load_refresh_token(&self) -> Result<Option<String>> {
        let keyring = keyring::Entry::new("prism-calendar", "google-refresh-token")
            .context("Failed to create keyring entry")?;
        
        match keyring.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(anyhow::anyhow!("Failed to load refresh token: {}", e)),
        }
    }

    pub async fn clear_tokens(&self) -> Result<()> {
        let mut store = self.token_store.lock().await;
        *store = None;

        let keyring = keyring::Entry::new("prism-calendar", "google-refresh-token")
            .context("Failed to create keyring entry")?;
        keyring.delete_password()
            .or_else(|e| {
                if matches!(e, keyring::Error::NoEntry) {
                    Ok(())
                } else {
                    Err(e)
                }
            })
            .context("Failed to clear refresh token")?;

        Ok(())
    }
}

