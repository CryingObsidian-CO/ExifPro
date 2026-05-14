use std::fs;
use std::io::Error;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub async fn scan_directory(dir: &Path, recursive: bool) -> Result<Vec<PathBuf>, String> {
    let dir = dir.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || scan_directory_sync(&dir, recursive))
        .await
        .map_err(|err| format!("Failed to join scan task: {}", err))?
}

fn scan_directory_sync(dir: &Path, recursive: bool) -> Result<Vec<PathBuf>, String> {
    let mut image_paths = Vec::new();

    if recursive {
        for entry in WalkDir::new(dir) {
            let entry = entry.map_err(|err| err.to_string())?;
            let path = entry.path();
            if path.is_file() && is_image_file(path) {
                image_paths.push(path.to_path_buf());
            }
        }
    } else {
        let entries = fs::read_dir(dir).map_err(|err| err.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|err| err.to_string())?;
            let path = entry.path();
            if path.is_file() && is_image_file(&path) {
                image_paths.push(path);
            }
        }
    }

    Ok(image_paths)
}

fn is_image_file(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let allowed_exts = [
        "jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "heic", "heif", "arw", "cr2",
        "cr3", "nef", "dng", "raf", "rw2", "orf", "srw", "pef", "x3f",
    ];
    allowed_exts.contains(&ext.as_str())
}

pub fn safe_copy(src: &Path, dest: &Path, overwrite: bool) -> Result<(), String> {
    ensure_dest_writable(dest, overwrite)?;

    if let Some(parent) = dest.parent() {
        create_dirs_if_not_exist(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::copy(src, dest).map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

pub fn safe_move(src: &Path, dest: &Path, overwrite: bool) -> Result<(), String> {
    ensure_dest_writable(dest, overwrite)?;

    if let Some(parent) = dest.parent() {
        create_dirs_if_not_exist(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::rename(src, dest).map_err(|e| format!("Failed to move file: {}", e))?;
    Ok(())
}

fn ensure_dest_writable(dest: &Path, overwrite: bool) -> Result<(), String> {
    if dest.exists() {
        if overwrite {
            fs::remove_file(dest).map_err(|e| format!("Failed to remove file: {}", e))?;
        } else {
            return Err(format!("Destination file already exists: {:?}", dest));
        }
    }
    Ok(())
}

pub fn create_dirs_if_not_exist(path: &Path) -> Result<(), Error> {
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    Ok(())
}
