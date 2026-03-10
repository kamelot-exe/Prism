pub mod categories_api;
pub mod events_api;
pub mod notifications_api;
pub mod gmail_api;
pub mod pomodoro_api;
pub mod settings_api;
pub mod suggestions_api;
pub mod tasks_api;

pub mod events {
    pub use super::events_api::*;
}

pub mod categories {
    pub use super::categories_api::*;
}

pub mod tasks {
    pub use super::tasks_api::*;
}

pub mod settings {
    pub use super::settings_api::*;
}

pub mod pomodoro {
    pub use super::pomodoro_api::*;
}
