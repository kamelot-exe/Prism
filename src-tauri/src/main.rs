// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod db;
mod gmail;

use db::init_db;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = init_db(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::events::get_events,
            api::events::create_event,
            api::events::update_event,
            api::events::delete_event,
            api::categories::list_categories,
            api::categories::create_category,
            api::gmail::gmail_get_auth_url,
            api::gmail::gmail_wait_for_callback,
            api::gmail::gmail_exchange_code,
            api::gmail::sync_gmail,
            api::gmail::gmail_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

