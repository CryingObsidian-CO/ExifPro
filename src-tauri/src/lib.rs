pub mod config;
pub mod exif;
pub mod file_ops;
pub mod grouping;

use crate::config::Config;
use crate::exif::{parse_exif, ExifInfo};
use crate::file_ops::{create_dirs_if_not_exist, safe_copy, safe_move, scan_directory};
use crate::grouping::{group_photos, Group};
use std::path::Path;

#[tauri::command]
fn scan_directory_command(path: String, recursive: bool) -> Result<Vec<ExifInfo>, String> {
    let dir_path = Path::new(&path);
    let image_paths = scan_directory(dir_path, recursive)
        .map_err(|e| format!("Failed to scan directory: {}", e))?;

    let mut exif_infos = Vec::new();
    for image_path in image_paths {
        match parse_exif(&image_path) {
            Ok(info) => exif_infos.push(info),
            Err(e) => eprintln!("Warning: Failed to parse EXIF from {:?}: {}", image_path, e),
        }
    }

    Ok(exif_infos)
}
#[tauri::command]
async fn group_photos_command(
    photos: Vec<ExifInfo>,
    config: Option<Config>,
) -> Result<Vec<Group>, String> {
    let config = config.unwrap_or(Config::default());
    Ok(group_photos(photos, &config))
}

#[tauri::command]
async fn save_config_command(config: Config) -> Result<(), String> {
    config
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))
}
#[tauri::command]
async fn load_config_command() -> Config {
    Config::load().unwrap_or(Config::default())
}

#[tauri::command]
async fn reset_config_command() -> Config {
    Config::default()
}

#[tauri::command]
async fn organize_files_command(
    groups: Vec<Group>,
    output_dir: String,
    copy_mode: bool,
    overwrite: bool,
) -> Result<(), String> {
    let output_path = Path::new(&output_dir);
    create_dirs_if_not_exist(output_path)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    for group in groups {
        let group_dir = output_path.join(&group.name);
        create_dirs_if_not_exist(&group_dir)
            .map_err(|e| format!("Failed to create group directory: {}", e))?;

        for photo in group.photos {
            let src_path = Path::new(&photo.file_path);
            let dest_path = group_dir.join(&photo.file_name);

            if copy_mode {
                safe_copy(src_path, &dest_path, overwrite)
                    .map_err(|e| format!("Failed to copy file {:?}: {}", src_path, e))?;
            } else {
                safe_move(src_path, &dest_path, overwrite)
                    .map_err(|e| format!("Failed to move file {:?}: {}", src_path, e))?;
            }
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory_command,
            group_photos_command,
            save_config_command,
            load_config_command,
            reset_config_command,
            organize_files_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
