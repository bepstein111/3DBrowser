mod bookmarks;
mod fs;
mod ops;
mod thumbs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .invoke_handler(tauri::generate_handler![
            fs::list_dir,
            fs::read_file,
            fs::home_dir,
            ops::move_entry,
            ops::copy_entries,
            ops::create_folder,
            ops::delete_entry,
            bookmarks::load_bookmarks,
            bookmarks::save_bookmarks,
            thumbs::read_thumbnail,
            thumbs::write_thumbnail,
            thumbs::clear_thumbnail_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
