use chrono::{DateTime, Utc};
use tauri::State;

use crate::{
    db::planned_blocks_repo,
    db::DbPool,
    domain::{NewPlannedBlock, PlannedBlock, UpdatePlannedBlock},
    error::AppError,
};

fn validate_block_times(start_ts: DateTime<Utc>, end_ts: DateTime<Utc>) -> Result<(), AppError> {
    if end_ts <= start_ts {
        return Err(AppError::Validation("planned block end_ts must be after start_ts".to_string()));
    }
    Ok(())
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn createPlannedBlock(
    pool: State<'_, DbPool>,
    payload: NewPlannedBlock,
) -> Result<PlannedBlock, AppError> {
    validate_block_times(payload.start_ts, payload.end_ts)?;
    planned_blocks_repo::create_planned_block(&pool, payload).await
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn updatePlannedBlock(
    pool: State<'_, DbPool>,
    payload: UpdatePlannedBlock,
) -> Result<PlannedBlock, AppError> {
    if let (Some(start_ts), Some(end_ts)) = (payload.start_ts, payload.end_ts) {
        validate_block_times(start_ts, end_ts)?;
    }
    planned_blocks_repo::update_planned_block(&pool, payload).await
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn deletePlannedBlock(pool: State<'_, DbPool>, id: i64) -> Result<(), AppError> {
    planned_blocks_repo::delete_planned_block(&pool, id).await
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn listPlannedBlocksRange(
    pool: State<'_, DbPool>,
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
) -> Result<Vec<PlannedBlock>, AppError> {
    planned_blocks_repo::list_planned_blocks_range(&pool, start, end).await
}
