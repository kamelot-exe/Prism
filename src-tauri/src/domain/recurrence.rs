use chrono::{NaiveDate, Datelike};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Recurrence {
    pub kind: String, // "daily" | "weekly" | "monthly" | "yearly" | "custom"
    pub interval: Option<i32>, // For daily/weekly/monthly/yearly: default interval
    pub days_of_week: Option<Vec<i32>>, // 0=Monday, 1=Tuesday, ..., 6=Sunday
}

/// Calculate the next occurrence date based on recurrence rules
pub fn next_occurrence(original: &NaiveDate, recurrence: &Recurrence) -> Option<NaiveDate> {
    let interval = recurrence.interval.unwrap_or(1);
    
    match recurrence.kind.as_str() {
        "daily" => {
            original.checked_add_signed(chrono::Duration::days(interval as i64))
        }
        "weekly" => {
            if let Some(days) = &recurrence.days_of_week {
                if days.is_empty() {
                    // Fallback to interval weeks
                    original.checked_add_signed(chrono::Duration::weeks(interval as i64))
                } else {
                    // Find next matching weekday
                    find_next_weekday(original, days, interval)
                }
            } else {
                // No days specified, use interval weeks
                original.checked_add_signed(chrono::Duration::weeks(interval as i64))
            }
        }
        "monthly" => {
            next_month_same_day(original, interval)
        }
        "yearly" => {
            next_year_same_day(original, interval)
        }
        "custom" => {
            // Custom uses interval as days
            original.checked_add_signed(chrono::Duration::days(interval as i64))
        }
        _ => None, // Invalid kind
    }
}

fn find_next_weekday(date: &NaiveDate, days_of_week: &[i32], interval: i32) -> Option<NaiveDate> {
    // Convert date to weekday (0=Monday, 6=Sunday)
    let current_weekday = date.weekday().num_days_from_monday() as i32;
    
    // Sort days of week for easier processing
    let mut sorted_days: Vec<i32> = days_of_week.iter().copied().collect();
    sorted_days.sort();
    
    // Find next matching day in current week
    for &target_day in &sorted_days {
        if target_day > current_weekday {
            let days_ahead = target_day - current_weekday;
            if let Some(next) = date.checked_add_signed(chrono::Duration::days(days_ahead as i64)) {
                return Some(next);
            }
        }
    }
    
    // If no match in current week, find first day in next interval weeks
    if interval > 0 {
        // Calculate days to next week's first matching day
        let days_to_next_week = 7 - current_weekday;
        let first_day_of_week = sorted_days[0];
        let total_days = days_to_next_week + first_day_of_week + ((interval - 1) * 7);
        date.checked_add_signed(chrono::Duration::days(total_days as i64))
    } else {
        // Fallback: add 1 week to first matching day
        let days_to_next_week = 7 - current_weekday;
        let first_day_of_week = sorted_days[0];
        let total_days = days_to_next_week + first_day_of_week;
        date.checked_add_signed(chrono::Duration::days(total_days as i64))
    }
}

fn next_month_same_day(original: &NaiveDate, interval: i32) -> Option<NaiveDate> {
    let mut year = original.year();
    let mut month = original.month();
    let day = original.day();
    
    // Add interval months
    for _ in 0..interval {
        month += 1;
        if month > 12 {
            month = 1;
            year += 1;
        }
    }
    
    // Handle day overflow (e.g., Jan 31 -> Feb 28/29)
    let max_day = days_in_month(year, month);
    let target_day = if day > max_day { max_day } else { day };
    
    NaiveDate::from_ymd_opt(year, month, target_day)
}

fn next_year_same_day(original: &NaiveDate, interval: i32) -> Option<NaiveDate> {
    let year = original.year() + interval as i32;
    let month = original.month();
    let day = original.day();
    
    // Handle leap year edge case (Feb 29)
    let max_day = days_in_month(year, month);
    let target_day = if day > max_day { max_day } else { day };
    
    NaiveDate::from_ymd_opt(year, month, target_day)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 28,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_daily_recurrence() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let recurrence = Recurrence {
            kind: "daily".to_string(),
            interval: Some(1),
            days_of_week: None,
        };
        let next = next_occurrence(&date, &recurrence).unwrap();
        assert_eq!(next, NaiveDate::from_ymd_opt(2024, 1, 2).unwrap());
    }

    #[test]
    fn test_weekly_recurrence() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(); // Monday
        let recurrence = Recurrence {
            kind: "weekly".to_string(),
            interval: Some(1),
            days_of_week: Some(vec![2, 4]), // Wednesday, Friday
        };
        let next = next_occurrence(&date, &recurrence).unwrap();
        assert_eq!(next, NaiveDate::from_ymd_opt(2024, 1, 3).unwrap()); // Wednesday
    }

    #[test]
    fn test_monthly_recurrence() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 15).unwrap();
        let recurrence = Recurrence {
            kind: "monthly".to_string(),
            interval: Some(1),
            days_of_week: None,
        };
        let next = next_occurrence(&date, &recurrence).unwrap();
        assert_eq!(next, NaiveDate::from_ymd_opt(2024, 2, 15).unwrap());
    }
}

