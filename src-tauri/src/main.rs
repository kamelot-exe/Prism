#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod db;
mod gmail;
mod error;
mod domain;

use api::{
    categories::*,
    events::*,
    focus_sessions::*,
    gmail_api::*,
    notifications_api::*,
    planned_blocks::*,
    pomodoro::*,
    recurrence_exceptions::*,
    settings::*,
    tasks::*,
};
use crate::api::suggestions_api::suggestions_stub;

use db::pool::create_pool;
use tauri::{async_runtime, Builder, Manager};

#[tokio::main]
async fn main() {
    Builder::default()
        .setup(|app| {
            let db = async_runtime::block_on(create_pool(&app.handle()))
                .expect("Failed to initialize database");
            app.manage(db);
            Ok(())
        })
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            events_list,
            events_create,
            events_update,
            events_delete,

            categories_list,
            categories_create,
            categories_update,
            categories_delete,

            tasks_list,
            tasks_list_range,
            tasks_create,
            tasks_update,
            tasks_toggle_done,
            tasks_delete,
            task_parse_create,

            createPlannedBlock,
            updatePlannedBlock,
            deletePlannedBlock,
            listPlannedBlocksRange,

            createFocusSession,
            completeFocusSession,
            listFocusSessionsRange,

            createRecurrenceException,
            listRecurrenceExceptions,

            settings_get,
            settings_save,

            pomodoro_log_session,
            pomodoro_list_for_date,
            pomodoro_list_range,

            suggestions_stub,

            gmail_get_auth_url,
            gmail_wait_for_callback,
            gmail_exchange_code,
            gmail_disconnect,
            gmail_sync,
            gmail_status,

            notify_event,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Prism Calendar");
}
