mod oauth;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx;

use crate::db::DbPool;
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
    pool: DbPool,
}

impl GmailClient {
    pub fn new(client_id: String, client_secret: String, redirect_url: String, pool: DbPool) -> Result<Self> {
        Ok(GmailClient {
            oauth_client: OAuthClient::new(client_id, client_secret, redirect_url)?,
            http_client: reqwest::Client::new(),
            pool,
        })
    }

    pub async fn get_authorization_url(&self) -> Result<(String, String)> {
        let (url, state) = self.oauth_client.get_authorization_url()?;
        Ok((url.to_string(), state))
    }

    pub async fn exchange_code(&self, code: String) -> Result<TokenInfo> {
        self.oauth_client.exchange_code(code).await
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
                return Err(anyhow::anyhow!(
                    "Google API returned status {}",
                    response.status()
                ));
            }

            let body = response.text().await.context("Failed to read response body")?;
            let calendar_response: GoogleCalendarResponse = serde_json::from_str(&body)
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

        let mut synced_count = 0;

        for event in events {
            let (start_time, end_time, all_day) = if let Some(dt) = &event.start.date_time {
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
                continue;
            };

            let existing: Option<i64> = sqlx::query_scalar(
                "SELECT id FROM events WHERE source = ? AND external_id = ?",
            )
            .bind("google")
            .bind(&event.id)
            .fetch_optional(&self.pool)
            .await
            .context("Failed to query existing event")?;

            if existing.is_some() {
                sqlx::query(
                    "UPDATE events SET title = ?, description = ?, start_ts = ?, end_ts = ?, all_day = ?, updated_at = CURRENT_TIMESTAMP WHERE source = ? AND external_id = ?",
                )
                .bind(event.summary.clone().unwrap_or_else(|| "Untitled".to_string()))
                .bind(event.description.clone())
                .bind(start_time.clone())
                .bind(end_time.clone())
                .bind(if all_day { 1 } else { 0 })
                .bind("google")
                .bind(&event.id)
                .execute(&self.pool)
                .await
                .context("Failed to update event")?;
            } else {
                sqlx::query(
                    "INSERT INTO events(title, description, start_ts, end_ts, all_day, source, external_id) VALUES (?, ?, ?, ?, ?, 'google', ?)",
                )
                .bind(event.summary.clone().unwrap_or_else(|| "Untitled".to_string()))
                .bind(event.description.clone())
                .bind(start_time.clone())
                .bind(end_time.clone())
                .bind(if all_day { 1 } else { 0 })
                .bind(&event.id)
                .execute(&self.pool)
                .await
                .context("Failed to insert event")?;
            }

            synced_count += 1;
        }

        Ok(synced_count)
    }
}
