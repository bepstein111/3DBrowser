use serde::Serialize;
use std::path::Path;
use std::time::UNIX_EPOCH;
use tauri::Manager;

pub const MODEL_EXTENSIONS: &[&str] = &["stl", "obj", "3mf", "step", "stp", "igs", "iges"];

pub fn is_model_extension(ext: &str) -> bool {
    MODEL_EXTENSIONS.contains(&ext)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_model: bool,
    pub size: u64,
    pub modified_ms: u64,
    pub extension: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<Entry>,
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<DirListing, String> {
    let dir = Path::new(&path);
    let read = std::fs::read_dir(dir).map_err(|e| format!("{path}: {e}"))?;

    let mut entries = Vec::new();
    for item in read.flatten() {
        let child = item.path();
        let meta = match std::fs::metadata(&child) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let name = item.file_name().to_string_lossy().to_string();
        let extension = child
            .extension()
            .map(|e| e.to_string_lossy().to_ascii_lowercase());
        let is_dir = meta.is_dir();
        let is_model = !is_dir
            && extension
                .as_deref()
                .map(is_model_extension)
                .unwrap_or(false);
        let size = if is_dir { 0 } else { meta.len() };
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        entries.push(Entry {
            name,
            path: child.to_string_lossy().to_string(),
            is_dir,
            is_model,
            size,
            modified_ms,
            extension,
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_ascii_lowercase().cmp(&b.name.to_ascii_lowercase()))
    });

    let parent = dir.parent().map(|p| p.to_string_lossy().to_string());

    Ok(DirListing {
        path,
        parent,
        entries,
    })
}

#[tauri::command]
pub fn read_file(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("{path}: {e}"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn home_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}
