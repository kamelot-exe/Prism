#[tauri::command]
pub async fn suggestions_stub() -> Result<String, String> {
    Ok("suggestions engine is frontend-only for now".into())
}

