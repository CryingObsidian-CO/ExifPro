use std::fs;
use std::io::Error;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub fn scan_directory(dir: &Path, recursive: bool) -> Result<Vec<PathBuf>, String> {
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
    // TODO 允许更多后缀
    ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "arw"
}

pub fn safe_copy(src: &Path, dest: &Path, overwrite: bool) -> Result<(), String> {
    if dest.exists() {
        if overwrite {
            fs::remove_file(dest).map_err(|e| format!("Failed to remove file: {}", e))?;
        } else {
            return Err(format!("Destination file already exists: {:?}", dest));
        }
    }

    if let Some(parent) = dest.parent() {
        create_dirs_if_not_exist(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::copy(src, dest).map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

pub fn safe_move(src: &Path, dest: &Path, overwrite: bool) -> Result<(), String> {
    if dest.exists() {
        if overwrite {
            fs::remove_file(dest).map_err(|e| format!("Failed to remove file: {}", e))?;
        } else {
            return Err(format!("Destination file already exists: {:?}", dest));
        }
    }

    if let Some(parent) = dest.parent() {
        create_dirs_if_not_exist(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::rename(src, dest).map_err(|e| format!("Failed to move file: {}", e))?;
    Ok(())
}

pub fn create_dirs_if_not_exist(path: &Path) -> Result<(), Error> {
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    Ok(())
}
