use base64::Engine;
use std::path::PathBuf;
use tauri::Manager;

fn fnv1a(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("thumbnails");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn cache_key(path: &str, modified_ms: u64, size: u64, version: u32) -> String {
    let mut data = path.as_bytes().to_vec();
    data.extend_from_slice(&modified_ms.to_le_bytes());
    data.extend_from_slice(&size.to_le_bytes());
    data.extend_from_slice(&version.to_le_bytes());
    format!("{:016x}", fnv1a(&data))
}

#[tauri::command]
pub fn read_thumbnail(
    app: tauri::AppHandle,
    path: String,
    modified_ms: u64,
    size: u64,
    version: u32,
) -> Option<String> {
    let file = cache_dir(&app)
        .ok()?
        .join(format!("{}.png", cache_key(&path, modified_ms, size, version)));
    let bytes = std::fs::read(file).ok()?;
    Some(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub fn write_thumbnail(
    app: tauri::AppHandle,
    path: String,
    modified_ms: u64,
    size: u64,
    version: u32,
    data: String,
) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|e| e.to_string())?;
    let file = cache_dir(&app)?.join(format!("{}.png", cache_key(&path, modified_ms, size, version)));
    std::fs::write(file, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_thumbnail_cache(app: tauri::AppHandle) -> Result<(), String> {
    let dir = cache_dir(&app)?;
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let _ = std::fs::remove_file(entry.path());
    }
    Ok(())
}
