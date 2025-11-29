mod oauth;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::db::get_pool;
use oauth::OAuthClient;

pub use oauth::TokenInfo;

const GOOGLE_CALENDAR_API: &str = "https://www.googleapis.com/calendar/v3";

#[derive(Debug, Serialize, Deserialize)]
struct GoogleCalendarEvent {
    id: String,
    summary: Option<String>,
    description: Option<String>,
    start: GoogleEventDateTime,
    end: GoogleEventDateTime,
    updated: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GoogleEventDateTime {
    date_time: Option<String>,
    date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GoogleCalendarResponse {
    items: Vec<GoogleCalendarEvent>,
    next_page_token: Option<String>,
}

pub struct GmailClient {
    oauth_client: OAuthClient,
    http_client: reqwest::Client,
}

impl GmailClient {
    pub fn new(client_id: String, client_secret: String, redirect_url: String) -> Result<Self> {
        Ok(GmailClient {
            oauth_client: OAuthClient::new(client_id, client_secret, redirect_url)?,
            http_client: reqwest::Client::new(),
        })
    }

    pub async fn fetch_gmail_events(
        &self,
        time_min: Option<DateTime<Utc>>,
        time_max: Option<DateTime<Utc>>,
    ) -> Result<Vec<GoogleCalendarEvent>> {
        let access_token = self.oauth_client.get_valid_token().await?;

        let mut all_events = Vec::new();
        let mut page_token: Option<String> = None;

        loop {
            let mut url = format!("{}/calendars/primary/events", GOOGLE_CALENDAR_API);
            url.push_str("?singleEvents=true&orderBy=startTime");

            if let Some(tm) = time_min {
                url.push_str(&format!("&timeMin={}", tm.to_rfc3339()));
            }
            if let Some(tm) = time_max {
                url.push_str(&format!("&timeMax={}", tm.to_rfc3339()));
            }
            if let Some(ref pt) = page_token {
                url.push_str(&format!("&pageToken={}", pt));
            }

            let response = self
                .http_client
                .get(&url)
                .header("Authorization", format!("Bearer {}", access_token))
                .send()
                .await
                .context("Failed to fetch calendar events")?;

            if !response.status().is_success() {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                anyhow::bail!(
                    "Google Calendar API error: {} - {}",
                    status,
                    error_text
                );
            }

            let calendar_response: GoogleCalendarResponse = response
                .json()
                .await
                .context("Failed to parse calendar response")?;

            all_events.extend(calendar_response.items);

            page_token = calendar_response.next_page_token;
            if page_token.is_none() {
                break;
            }
        }

        Ok(all_events)
    }

    pub async fn sync_to_database(
        &self,
        time_min: Option<DateTime<Utc>>,
        time_max: Option<DateTime<Utc>>,
    ) -> Result<usize> {
        let events = self.fetch_gmail_events(time_min, time_max).await?;
        let pool = get_pool()?;

        let mut synced_count = 0;

        for event in events {
            // Parse start and end times
            let (start_time, end_time, all_day) = if let Some(dt) = &event.start.date_time {
                // Timed event
                let start = DateTime::parse_from_rfc3339(dt)
                    .context("Failed to parse start time")?
                    .with_timezone(&Utc);
                let end = if let Some(dt) = &event.end.date_time {
                    DateTime::parse_from_rfc3339(dt)
                        .context("Failed to parse end time")?
                        .with_timezone(&Utc)
                } else {
                    start + chrono::Duration::hours(1)
                };
                (start.to_rfc3339(), end.to_rfc3339(), false)
            } else if let Some(date) = &event.start.date {
                // All-day event
                let start = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
                    .context("Failed to parse start date")?
                    .and_hms_opt(0, 0, 0)
                    .unwrap();
                let end = if let Some(date) = &event.end.date {
                    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
                        .context("Failed to parse end date")?
                        .and_hms_opt(0, 0, 0)
                        .unwrap()
                } else {
                    start + chrono::Duration::days(1)
                };
                (
                    DateTime::<Utc>::from_naive_utc_and_offset(start, Utc).to_rfc3339(),
                    DateTime::<Utc>::from_naive_utc_and_offset(end, Utc).to_rfc3339(),
                    true,
                )
            } else {
                continue; // Skip events without valid time
            };

            let title = event.summary.unwrap_or_else(|| "Untitled Event".to_string());
            let description = event.description;
            let external_id = event.id;
            let source = "gmail";

            // Check if event already exists
            let existing: Option<i64> = sqlx::query_scalar(
                "SELECT id FROM events WHERE source = ? AND external_id = ?"
            )
            .bind(source)
            .bind(&external_id)
            .fetch_optional(&pool)
            .await?;

            if let Some(existing_id) = existing {
                // Update existing event
                sqlx::query(
                    r#"
                    UPDATE events 
                    SET title = ?, description = ?, start_time = ?, end_time = ?, all_day = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    "#
                )
                .bind(&title)
                .bind(&description)
                .bind(&start_time)
                .bind(&end_time)
                .bind(if all_day { 1 } else { 0 })
                .bind(existing_id)
                .execute(&pool)
                .await?;
            } else {
                // Insert new event
                sqlx::query(
                    r#"
                    INSERT INTO events (title, description, start_time, end_time, all_day, source, external_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    "#
                )
                .bind(&title)
                .bind(&description)
                .bind(&start_time)
                .bind(&end_time)
                .bind(if all_day { 1 } else { 0 })
                .bind(source)
                .bind(&external_id)
                .execute(&pool)
                .await?;
            }

            synced_count += 1;
        }

        Ok(synced_count)
    }

    pub fn get_authorization_url(&self) -> Result<(url::Url, String)> {
        self.oauth_client.get_authorization_url()
    }

    pub async fn exchange_code(&self, code: String) -> Result<TokenInfo> {
        let token_info = self.oauth_client.exchange_code(code).await?;
        self.oauth_client
            .save_refresh_token(&token_info.refresh_token)
            .await?;
        Ok(token_info)
    }

    pub async fn clear_tokens(&self) -> Result<()> {
        self.oauth_client.clear_tokens().await
    }
}
