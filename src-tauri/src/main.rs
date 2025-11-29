// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod db;
mod domain;
mod error;
mod gmail;

use db::create_pool;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            let pool = match tauri::async_runtime::block_on(create_pool(&handle)) {
                Ok(pool) => pool,
                Err(e) => {
                    return Err(Box::new(e) as Box<dyn std::error::Error + Send + Sync>);
                }
            };
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::events_api::events_list,
            api::events_api::events_create,
            api::events_api::events_update,
            api::events_api::events_delete,
            api::categories_api::categories_list,
            api::categories_api::categories_create,
            api::categories_api::categories_update,
            api::categories_api::categories_delete,
            api::tasks_api::tasks_list,
            api::tasks_api::tasks_create,
            api::tasks_api::tasks_update,
            api::tasks_api::tasks_delete,
            api::settings_api::settings_list,
            api::settings_api::settings_put,
            api::gmail_api::gmail_get_auth_url,
            api::gmail_api::gmail_wait_for_callback,
            api::gmail_api::gmail_exchange_code,
            api::gmail_api::sync_gmail,
            api::gmail_api::gmail_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
