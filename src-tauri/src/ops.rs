use std::ffi::OsStr;
use std::path::{Path, PathBuf};

fn io_err(path: &Path, e: std::io::Error) -> String {
    format!("{}: {e}", path.display())
}

/// Finds a non-conflicting file name inside `dir` by appending " (n)".
fn unique_destination(dir: &Path, file_name: &OsStr) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let name = Path::new(file_name);
    let stem = name
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = name.extension().map(|s| s.to_string_lossy().to_string());

    for n in 2..10_000 {
        let next = match &extension {
            Some(ext) => format!("{stem} ({n}).{ext}"),
            None => format!("{stem} ({n})"),
        };
        let candidate = dir.join(next);
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(file_name)
}

fn canonical(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn copy_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    if source.is_dir() {
        std::fs::create_dir_all(destination).map_err(|e| io_err(destination, e))?;
        for entry in std::fs::read_dir(source).map_err(|e| io_err(source, e))? {
            let entry = entry.map_err(|e| io_err(source, e))?;
            copy_recursive(&entry.path(), &destination.join(entry.file_name()))?;
        }
    } else {
        std::fs::copy(source, destination).map_err(|e| io_err(destination, e))?;
    }
    Ok(())
}

fn remove_recursive(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|e| io_err(path, e))
    } else {
        std::fs::remove_file(path).map_err(|e| io_err(path, e))
    }
}

/// Moves a file or folder into `dest_dir`, returning the resulting path.
///
/// Falls back to copy + delete when a plain rename crosses filesystems. A
/// name clash resolves to a " (n)" suffixed name instead of overwriting.
#[tauri::command]
pub fn move_entry(source: String, dest_dir: String) -> Result<String, String> {
    let source = PathBuf::from(&source);
    let dest_dir = PathBuf::from(&dest_dir);

    if !source.exists() {
        return Err(format!("Source does not exist: {}", source.display()));
    }
    if !dest_dir.is_dir() {
        return Err(format!("Not a folder: {}", dest_dir.display()));
    }

    let file_name = source
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?;

    let source_canon = canonical(&source);
    let dest_canon = canonical(&dest_dir);

    if dest_canon == source_canon {
        return Err("Cannot move a folder into itself".to_string());
    }
    if dest_canon.starts_with(&source_canon) {
        return Err("Cannot move a folder into one of its subfolders".to_string());
    }
    if source_canon.parent() == Some(dest_canon.as_path()) {
        return Ok(source.to_string_lossy().to_string());
    }

    let destination = unique_destination(&dest_dir, file_name);

    match std::fs::rename(&source, &destination) {
        Ok(()) => Ok(destination.to_string_lossy().to_string()),
        Err(_) => {
            copy_recursive(&source, &destination)?;
            remove_recursive(&source)?;
            Ok(destination.to_string_lossy().to_string())
        }
    }
}

/// Creates a new folder inside `parent`, returning the created path.
#[tauri::command]
pub fn create_folder(parent: String, name: String) -> Result<String, String> {
    let parent = PathBuf::from(&parent);
    if !parent.is_dir() {
        return Err(format!("Not a folder: {}", parent.display()));
    }

    let trimmed = name.trim();
    let base = if trimmed.is_empty() { "New Folder" } else { trimmed };
    if base.contains('/') || base.contains('\\') {
        return Err("Folder name cannot contain path separators".to_string());
    }

    let destination = unique_destination(&parent, std::ffi::OsStr::new(base));
    std::fs::create_dir(&destination).map_err(|e| io_err(&destination, e))?;
    Ok(destination.to_string_lossy().to_string())
}

/// Copies files or folders into `dest_dir`, returning the created paths.
#[tauri::command]
pub fn copy_entries(paths: Vec<String>, dest_dir: String) -> Result<Vec<String>, String> {
    let dest_dir = PathBuf::from(&dest_dir);
    if !dest_dir.is_dir() {
        return Err(format!("Not a folder: {}", dest_dir.display()));
    }

    let mut created = Vec::new();
    for path in paths {
        let source = PathBuf::from(&path);
        if !source.exists() {
            continue;
        }
        let file_name = source
            .file_name()
            .ok_or_else(|| "Invalid source path".to_string())?;
        let destination = unique_destination(&dest_dir, file_name);
        copy_recursive(&source, &destination)?;
        created.push(destination.to_string_lossy().to_string());
    }
    Ok(created)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("3dbrowser-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn move_into_subfolder() {
        let root = temp_dir("move-sub");
        let file = root.join("a.stl");
        fs::write(&file, b"mesh").unwrap();
        let sub = root.join("sub");
        fs::create_dir(&sub).unwrap();

        let result = move_entry(file.to_string_lossy().into(), sub.to_string_lossy().into()).unwrap();
        assert_eq!(PathBuf::from(&result), sub.join("a.stl"));
        assert!(!file.exists());
        assert!(sub.join("a.stl").exists());

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn move_same_parent_is_noop() {
        let root = temp_dir("move-noop");
        let file = root.join("a.stl");
        fs::write(&file, b"mesh").unwrap();

        let result = move_entry(file.to_string_lossy().into(), root.to_string_lossy().into()).unwrap();
        assert_eq!(PathBuf::from(&result), file);
        assert!(file.exists());

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn move_resolves_name_conflict() {
        let root = temp_dir("move-conflict");
        let sub = root.join("sub");
        fs::create_dir(&sub).unwrap();
        let file = root.join("a.stl");
        fs::write(&file, b"one").unwrap();
        fs::write(sub.join("a.stl"), b"two").unwrap();

        let result = move_entry(file.to_string_lossy().into(), sub.to_string_lossy().into()).unwrap();
        assert_eq!(PathBuf::from(&result), sub.join("a (2).stl"));
        assert_eq!(fs::read(sub.join("a.stl")).unwrap(), b"two");
        assert_eq!(fs::read(sub.join("a (2).stl")).unwrap(), b"one");

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn move_folder_into_itself_is_rejected() {
        let root = temp_dir("move-self");
        let folder = root.join("things");
        fs::create_dir(&folder).unwrap();

        let error = move_entry(folder.to_string_lossy().into(), folder.to_string_lossy().into())
            .unwrap_err();
        assert!(error.contains("itself"));
        assert!(folder.exists());

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn copy_entries_copies_recursively() {
        let root = temp_dir("copy");
        let src = root.join("thing");
        fs::create_dir(&src).unwrap();
        fs::write(src.join("b.stl"), b"mesh").unwrap();
        let dest = root.join("dest");
        fs::create_dir(&dest).unwrap();

        let created = copy_entries(vec![src.to_string_lossy().into()], dest.to_string_lossy().into())
            .unwrap();
        assert_eq!(created.len(), 1);
        assert!(src.exists(), "source is kept after copy");
        assert!(dest.join("thing").join("b.stl").exists());

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn create_folder_resolves_conflict() {
        let root = temp_dir("new-folder");
        let created = create_folder(root.to_string_lossy().into(), "New Folder".into()).unwrap();
        assert_eq!(PathBuf::from(&created), root.join("New Folder"));

        let again = create_folder(root.to_string_lossy().into(), "New Folder".into()).unwrap();
        assert_eq!(PathBuf::from(&again), root.join("New Folder (2)"));
        assert!(PathBuf::from(&again).is_dir());

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn copy_resolves_conflict() {
        let root = temp_dir("copy-conflict");
        let file = root.join("a.obj");
        fs::write(&file, b"one").unwrap();
        let dest = root.join("dest");
        fs::create_dir(&dest).unwrap();
        fs::write(dest.join("a.obj"), b"two").unwrap();

        let created = copy_entries(vec![file.to_string_lossy().into()], dest.to_string_lossy().into())
            .unwrap();
        assert_eq!(PathBuf::from(&created[0]), dest.join("a (2).obj"));
        assert_eq!(fs::read(dest.join("a.obj")).unwrap(), b"two");

        fs::remove_dir_all(&root).ok();
    }
}

