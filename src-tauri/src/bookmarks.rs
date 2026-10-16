use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub created_at: u64,
}

fn store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("bookmarks.json"))
}

#[tauri::command]
pub fn load_bookmarks(app: tauri::AppHandle) -> Result<Vec<Bookmark>, String> {
    let file = store_path(&app)?;
    match std::fs::read_to_string(&file) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string()),
        Err(_) => Ok(Vec::new()),
    }
}

#[tauri::command]
pub fn save_bookmarks(app: tauri::AppHandle, bookmarks: Vec<Bookmark>) -> Result<(), String> {
    let file = store_path(&app)?;
    let text = serde_json::to_string_pretty(&bookmarks).map_err(|e| e.to_string())?;
    std::fs::write(file, text).map_err(|e| e.to_string())
}
