pub mod config;
pub mod exif;
pub mod file_ops;
pub mod grouping;
pub mod plugin;

use crate::config::Config;
use crate::exif::{parse_exif, ExifInfo};
use crate::file_ops::{create_dirs_if_not_exist, safe_copy, safe_move, scan_directory};
use crate::grouping::{group_photos, Group};
use crate::plugin::loader::PluginLoader;
use crate::plugin::manifest::PluginInfo;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env::current_exe;
use std::path::{Path, PathBuf};
use std::process::Command;

#[tauri::command]
async fn scan_directory_command(path: String, recursive: bool) -> Result<Vec<ExifInfo>, String> {
    let dir_path = Path::new(&path);
    let image_paths = scan_directory(dir_path, recursive)
        .await
        .map_err(|e| format!("Failed to scan directory: {}", e))?;

    // NOTE 如果后续还有别的配置项再改为传入 config
    let config = Config::load().unwrap_or_default();
    let max_preview_bytes = config.preview_max_mb.saturating_mul(1024 * 1024);

    let mut exif_infos = Vec::new();
    for image_path in image_paths {
        match parse_exif(&image_path, max_preview_bytes) {
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
    group_photos(photos, config).await
}

#[tauri::command]
async fn save_config_command(config: Config) -> Result<(), String> {
    config
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))
}
#[tauri::command]
async fn load_config_command() -> Result<Config, String> {
    Config::load().map_err(|e| format!("Failed to load config: {}", e))
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

#[tauri::command]
async fn list_plugins_command() -> Result<Vec<PluginInfo>, String> {
    let plugins = PluginLoader::discover_plugins()?;
    let config = Config::load().unwrap_or_default();
    Ok(plugins
        .into_iter()
        .map(|p| PluginInfo {
            enabled: config.enabled_plugins.contains(&p.manifest.id),
            manifest: p.manifest,
            zip_path: p.zip_path.to_string_lossy().to_string(),
            builtin: p.builtin,
        })
        .collect())
}

#[tauri::command]
async fn read_plugin_file_command(zip_path: String, file_name: String) -> Result<String, String> {
    let path = Path::new(&zip_path);
    let bytes = PluginLoader::read_file_from_zip(path, &file_name)?;
    String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {}", e))
}

#[tauri::command]
async fn read_plugin_binary_command(
    zip_path: String,
    file_name: String,
) -> Result<Vec<u8>, String> {
    let path = Path::new(&zip_path);
    PluginLoader::read_file_from_zip(path, &file_name)
}

#[tauri::command]
async fn enable_plugin_command(plugin_id: String) -> Result<(), String> {
    let mut config = Config::load().unwrap_or_default();
    if !config.enabled_plugins.contains(&plugin_id) {
        config.enabled_plugins.push(plugin_id);
        config.save().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn disable_plugin_command(plugin_id: String) -> Result<(), String> {
    let mut config = Config::load().unwrap_or_default();
    config.enabled_plugins.retain(|id| id != &plugin_id);
    config.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_plugin_config_command(plugin_id: String) -> Result<serde_json::Value, String> {
    let config = Config::load().unwrap_or_default();
    Ok(config
        .plugin_settings
        .get(&plugin_id)
        .cloned()
        .unwrap_or(serde_json::Value::Null))
}

#[tauri::command]
async fn set_plugin_config_command(
    plugin_id: String,
    plugin_config: serde_json::Value,
) -> Result<(), String> {
    let mut config = Config::load().unwrap_or_default();
    config.plugin_settings.insert(plugin_id, plugin_config);
    config.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn plugin_file_op_command(
    operation: String,
    path: String,
    data: Option<Vec<u8>>,
) -> Result<(), String> {
    match operation.as_str() {
        "mkdir" => create_dirs_if_not_exist(Path::new(&path)).map_err(|e| e.to_string()),
        "write" => {
            let data = data.ok_or("No data provided for write operation")?;
            std::fs::write(Path::new(&path), data).map_err(|e| e.to_string())
        }
        _ => Err(format!("Unknown file operation: {}", operation)),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

fn get_photoshop_args_file_path() -> Result<PathBuf, String> {
    let args_dir = std::env::temp_dir().join("ExifPro");
    create_dirs_if_not_exist(&args_dir).map_err(|e| e.to_string())?;
    Ok(args_dir.join("exifpro_ps_args.json"))
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
            list_plugins_command,
            read_plugin_file_command,
            read_plugin_binary_command,
            enable_plugin_command,
            disable_plugin_command,
            get_plugin_config_command,
            set_plugin_config_command,
            plugin_file_op_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
