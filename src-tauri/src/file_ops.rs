use std::fs;
use std::io::Error;
use std::path::{Path, PathBuf};
use tauri_plugin_log::log;
use walkdir::WalkDir;

pub async fn scan_directory(dir: &Path, recursive: bool) -> Result<Vec<PathBuf>, String> {
    let dir = dir.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || scan_directory_sync(&dir, recursive))
        .await
        .map_err(|err| format!("Failed to join scan task: {}", err))?
}

fn scan_directory_sync(dir: &Path, recursive: bool) -> Result<Vec<PathBuf>, String> {
    log::info!(
        "file_ops.scan_directory: start dir={} recursive={}",
        dir.display(),
        recursive
    );
    let mut image_paths = Vec::new();

    if recursive {
        for entry in WalkDir::new(dir) {
            let entry = match entry {
                Ok(dir) => dir,
                Err(err) => {
                    log::warn!(
                        "file_ops.scan_directory: entry_failed dir={} err={}",
                        dir.display(),
                        err
                    );
                    continue;
                }
            };
            let path = entry.path();
            if path.is_file() && is_image_file(path) {
                image_paths.push(path.to_path_buf());
            } else if path.is_file() {
                log::debug!(
                    "file_ops.scan_directory: skip_non_image path={}",
                    path.display()
                );
            }
        }
    } else {
        let entries = match fs::read_dir(dir) {
            Ok(dir) => dir,
            Err(err) => {
                log::error!(
                    "file_ops.scan_directory: read_dir_failed dir={} err={}",
                    dir.display(),
                    err
                );
                return Err(err.to_string());
            }
        };
        for entry in entries {
            let entry = match entry {
                Ok(dir) => dir,
                Err(err) => {
                    log::warn!(
                        "file_ops.scan_directory: entry_failed dir={} err={}",
                        dir.display(),
                        err
                    );
                    continue;
                }
            };
            let path = entry.path();
            if path.is_file() && is_image_file(&path) {
                image_paths.push(path);
            } else if path.is_file() {
                log::debug!(
                    "file_ops.scan_directory: skip_non_image path={}",
                    path.display()
                );
            }
        }
    }

    log::info!(
        "file_ops.scan_directory: complete images={}",
        image_paths.len()
    );
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
    log::debug!(
        "file_ops.copy: start src={} dest={} overwrite={}",
        src.display(),
        dest.display(),
        overwrite
    );
    ensure_dest_writable(dest, overwrite)?;

    if let Some(parent) = dest.parent() {
        create_dirs_if_not_exist(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::copy(src, dest).map_err(|e| {
        log::error!(
            "file_ops.copy: failed src={} dest={} err={}",
            src.display(),
            dest.display(),
            e
        );
        format!("Failed to copy file: {}", e)
    })?;
    log::debug!("file_ops.copy: complete dest={}", dest.display());
    Ok(())
}

pub fn safe_move(src: &Path, dest: &Path, overwrite: bool) -> Result<(), String> {
    log::debug!(
        "file_ops.move: start src={} dest={} overwrite={}",
        src.display(),
        dest.display(),
        overwrite
    );
    ensure_dest_writable(dest, overwrite)?;

    if let Some(parent) = dest.parent() {
        create_dirs_if_not_exist(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::rename(src, dest).map_err(|e| {
        log::error!(
            "file_ops.move: failed src={} dest={} err={}",
            src.display(),
            dest.display(),
            e
        );
        format!("Failed to move file: {}", e)
    })?;
    log::debug!("file_ops.move: complete dest={}", dest.display());
    Ok(())
}

fn ensure_dest_writable(dest: &Path, overwrite: bool) -> Result<(), String> {
    if dest.exists() {
        if overwrite {
            log::debug!("file_ops.dest: overwrite path={}", dest.display());
            fs::remove_file(dest).map_err(|e| format!("Failed to remove file: {}", e))?;
        } else {
            log::warn!(
                "file_ops.dest: exists path={} overwrite=false",
                dest.display()
            );
            return Err(format!("Destination file already exists: {:?}", dest));
        }
    }
    Ok(())
}

pub fn create_dirs_if_not_exist(path: &Path) -> Result<(), Error> {
    if !path.exists() {
        log::debug!("file_ops.mkdirs: create path={}", path.display());
        fs::create_dir_all(path)?;
    }
    Ok(())
}
