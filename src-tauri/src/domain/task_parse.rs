use chrono::{NaiveDate, Local, Datelike};
use serde::{Deserialize, Serialize};

use super::recurrence::Recurrence;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParsedTask {
    pub title: String,
    pub date: Option<NaiveDate>,
    pub priority: Option<String>, // "low" | "medium" | "high" | "urgent"
    pub recurrence: Option<Recurrence>,
}

/// Parse natural language task input
pub fn parse_task_text(text: &str) -> ParsedTask {
    let lower = text.to_lowercase();
    let mut remaining = text.trim().to_string();
    
    // Extract priority
    let priority = extract_priority(&lower);
    if priority.is_some() {
        let keywords = vec!["urgent", "high", "important", "medium", "normal", "low", "maybe", "later"];
        for keyword in keywords {
            remaining = remaining.replace(&format!(" {} ", keyword), " ")
                .replace(&format!("{} ", keyword), "")
                .replace(&format!(" {}", keyword), "")
                .trim()
                .to_string();
        }
    }
    
    // Extract recurrence
    let recurrence = extract_recurrence(&lower);
    
    // Extract date and time
    let (date, _time_text) = extract_date_and_time(&lower);
    
    // Clean title - remove common words
    let title = remaining
        .replace(" at ", " ")
        .replace(" on ", " ")
        .replace(" in ", " ")
        .trim()
        .to_string();
    
    ParsedTask {
        title: if title.is_empty() { "Untitled Task".to_string() } else { title },
        date,
        priority,
        recurrence,
    }
}

fn extract_priority(text: &str) -> Option<String> {
    if text.contains("urgent") {
        return Some("urgent".to_string());
    }
    if text.contains("high") || text.contains("important") {
        return Some("high".to_string());
    }
    if text.contains("low") || text.contains("maybe") || text.contains("later") {
        return Some("low".to_string());
    }
    if text.contains("medium") || text.contains("normal") {
        return Some("medium".to_string());
    }
    None
}

fn extract_recurrence(text: &str) -> Option<Recurrence> {
    // Every day
    if text.contains("every day") {
        return Some(Recurrence {
            kind: "daily".to_string(),
            interval: Some(1),
            days_of_week: None,
        });
    }
    
    // Every N days
    let words: Vec<&str> = text.split_whitespace().collect();
    for i in 0..words.len().saturating_sub(2) {
        if words[i] == "every" && i + 2 < words.len() {
            if let Ok(interval) = words[i + 1].parse::<i32>() {
                if words[i + 2].starts_with("day") {
                    return Some(Recurrence {
                        kind: "daily".to_string(),
                        interval: Some(interval),
                        days_of_week: None,
                    });
                }
            }
        }
    }
    
    // Every weekday
    let weekday_map: std::collections::HashMap<&str, i32> = [
        ("monday", 0), ("mon", 0),
        ("tuesday", 1), ("tue", 1), ("tues", 1),
        ("wednesday", 2), ("wed", 2),
        ("thursday", 3), ("thu", 3), ("thur", 3),
        ("friday", 4), ("fri", 4),
        ("saturday", 5), ("sat", 5),
        ("sunday", 6), ("sun", 6),
    ]
    .iter()
    .cloned()
    .collect();
    
    for (day_name, &day_num) in weekday_map.iter() {
        if text.contains(&format!("every {}", day_name)) {
            return Some(Recurrence {
                kind: "weekly".to_string(),
                interval: Some(1),
                days_of_week: Some(vec![day_num]),
            });
        }
    }
    
    // Every week
    if text.contains("every week") {
        return Some(Recurrence {
            kind: "weekly".to_string(),
            interval: Some(1),
            days_of_week: None,
        });
    }
    
    // Every month
    if text.contains("every month") {
        return Some(Recurrence {
            kind: "monthly".to_string(),
            interval: Some(1),
            days_of_week: None,
        });
    }
    
    // Every year
    if text.contains("every year") {
        return Some(Recurrence {
            kind: "yearly".to_string(),
            interval: Some(1),
            days_of_week: None,
        });
    }
    
    None
}

fn extract_date_and_time(text: &str) -> (Option<NaiveDate>, Option<String>) {
    let now = Local::now();
    let today = now.date_naive();
    
    // Extract date
    // Today
    if text.contains("today") {
        return (Some(today), None);
    }
    
    // Tomorrow
    if text.contains("tomorrow") {
        if let Some(tomorrow) = today.checked_add_signed(chrono::Duration::days(1)) {
            return (Some(tomorrow), None);
        }
    }
    
    // Yesterday
    if text.contains("yesterday") {
        if let Some(yesterday) = today.checked_sub_signed(chrono::Duration::days(1)) {
            return (Some(yesterday), None);
        }
    }
    
    // Next weekday
    let weekday_map: std::collections::HashMap<&str, u32> = [
        ("monday", 1), ("mon", 1),
        ("tuesday", 2), ("tue", 2), ("tues", 2),
        ("wednesday", 3), ("wed", 3),
        ("thursday", 4), ("thu", 4), ("thur", 4),
        ("friday", 5), ("fri", 5),
        ("saturday", 6), ("sat", 6),
        ("sunday", 0), ("sun", 0),
    ]
    .iter()
    .cloned()
    .collect();
    
    if text.contains("next") {
        for (day_name, &target_day) in weekday_map.iter() {
            if text.contains(&format!("next {}", day_name)) {
                let current_day = now.weekday().num_days_from_sunday() as u32;
                let days_until = if target_day > current_day {
                    target_day - current_day
                } else {
                    7 - (current_day - target_day)
                };
                if let Some(date) = today.checked_add_signed(chrono::Duration::days(days_until as i64)) {
                    return (Some(date), None);
                }
            }
        }
    }
    
    // Relative: "in N days/weeks"
    let words: Vec<&str> = text.split_whitespace().collect();
    for i in 0..words.len().saturating_sub(2) {
        if words[i] == "in" && i + 2 < words.len() {
            if let Ok(amount) = words[i + 1].parse::<i64>() {
                let unit = words[i + 2].to_lowercase();
                if unit.starts_with("day") {
                    if let Some(date) = today.checked_add_signed(chrono::Duration::days(amount)) {
                        return (Some(date), None);
                    }
                } else if unit.starts_with("week") {
                    if let Some(date) = today.checked_add_signed(chrono::Duration::days(amount * 7)) {
                        return (Some(date), None);
                    }
                }
            }
        }
    }
    
    // Default: today
    (Some(today), None)
}
