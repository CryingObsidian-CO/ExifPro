pub mod config;
pub mod exif;
pub mod file_ops;
pub mod grouping;
pub mod plugin;

use crate::config::Config;
use crate::exif::{get_thumbnail_data, parse_exif, ExifInfo};
use crate::file_ops::{create_dirs_if_not_exist, safe_copy, safe_move, scan_directory};
use crate::grouping::{group_photos, Group};
use crate::plugin::loader::PluginLoader;
use crate::plugin::manifest::PluginInfo;
use serde::{Deserialize, Serialize};
use std::env::current_exe;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri_plugin_log::{log, Target, TargetKind};

#[tauri::command]
async fn scan_directory_command(path: String, recursive: bool) -> Result<Vec<ExifInfo>, String> {
    log::info!(
        "command.scan_directory: start path={} recursive={}",
        path,
        recursive
    );
    let dir_path = Path::new(&path);
    let image_paths = scan_directory(dir_path, recursive)
        .await
        .map_err(|e| format!("Failed to scan directory: {}", e))?;

    let total = image_paths.len();
    let mut exif_infos = Vec::new();
    for image_path in image_paths {
        log::trace!(
            "command.scan_directory: parse_start path={}",
            image_path.display()
        );
        match parse_exif(&image_path) {
            Ok(info) => exif_infos.push(info),
            Err(e) => log::error!(
                "command.scan_directory: parse_failed path={} err={}",
                image_path.display(),
                e
            ),
        }
    }

    log::info!(
        "command.scan_directory: complete parsed={} total={}",
        exif_infos.len(),
        total
    );
    Ok(exif_infos)
}
#[tauri::command]
async fn get_thumbnail_command(
    file_path: String,
    level: String,
) -> Result<Option<String>, String> {
    log::info!(
        "command.get_thumbnail: start path={} level={}",
        file_path,
        level
    );
    let path = Path::new(&file_path);
    let config = Config::load().unwrap_or_default();
    let max_preview_bytes = config.preview_max_mb.saturating_mul(1024 * 1024);
    let result = get_thumbnail_data(path, &level, max_preview_bytes);
    log::info!(
        "command.get_thumbnail: complete path={} has_thumbnail={}",
        file_path,
        result.is_some()
    );
    Ok(result)
}
#[tauri::command]
async fn group_photos_command(
    photos: Vec<ExifInfo>,
    config: Option<Config>,
) -> Result<Vec<Group>, String> {
    log::info!(
        "command.group_photos: start photos={} config_provided={}",
        photos.len(),
        config.is_some()
    );
    let config = config.unwrap_or(Config::default());
    group_photos(photos, config).await
}

#[tauri::command]
async fn save_config_command(config: Config) -> Result<(), String> {
    log::info!("command.save_config: start");
    config
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))
}
#[tauri::command]
async fn load_config_command() -> Result<Config, String> {
    log::info!("command.load_config: start");
    Config::load().map_err(|e| format!("Failed to load config: {}", e))
}

#[tauri::command]
async fn reset_config_command() -> Config {
    log::info!("command.reset_config: start");
    Config::default()
}

#[tauri::command]
async fn organize_files_command(
    groups: Vec<Group>,
    output_dir: String,
    copy_mode: bool,
    overwrite: bool,
) -> Result<(), String> {
    log::info!(
        "command.organize_files: start groups={} output_dir={} copy_mode={} overwrite={}",
        groups.len(),
        output_dir,
        copy_mode,
        overwrite
    );
    let output_path = Path::new(&output_dir);
    create_dirs_if_not_exist(output_path)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    for group in groups {
        log::debug!(
            "command.organize_files: group name={} photos={}",
            group.name,
            group.photos.len()
        );
        let group_dir = output_path.join(&group.name);
        create_dirs_if_not_exist(&group_dir)
            .map_err(|e| format!("Failed to create group directory: {}", e))?;

        for photo in group.photos {
            let src_path = Path::new(&photo.file_path);
            let dest_path = group_dir.join(&photo.file_name);

            if copy_mode {
                safe_copy(src_path, &dest_path, overwrite)
                    .map_err(|e| format!("Failed to copy file {:?}: {}", src_path, e))?;
                log::debug!(
                    "command.organize_files: copied src={} dest={}",
                    src_path.display(),
                    dest_path.display()
                );
            } else {
                safe_move(src_path, &dest_path, overwrite)
                    .map_err(|e| format!("Failed to move file {:?}: {}", src_path, e))?;
                log::debug!(
                    "command.organize_files: moved src={} dest={}",
                    src_path.display(),
                    dest_path.display()
                );
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn list_plugins_command() -> Result<Vec<PluginInfo>, String> {
    log::info!("command.list_plugins: start");
    let plugins = PluginLoader::discover_plugins()?;
    let config = Config::load().unwrap_or_default();
    let result: Vec<PluginInfo> = plugins
        .into_iter()
        .map(|p| {
            let enabled = config.enabled_plugins.contains(&p.manifest.id);
            log::debug!(
                "command.list_plugins: plugin id={} enabled={} builtin={}",
                p.manifest.id,
                enabled,
                p.builtin
            );
            PluginInfo {
                enabled,
                manifest: p.manifest,
                zip_path: p.zip_path.to_string_lossy().to_string(),
                builtin: p.builtin,
            }
        })
        .collect();
    log::info!("command.list_plugins: complete plugins={}", result.len());
    Ok(result)
}

#[tauri::command]
async fn read_plugin_file_command(zip_path: String, file_name: String) -> Result<String, String> {
    log::info!(
        "command.read_plugin_file: zip={} file={}",
        zip_path,
        file_name
    );
    let path = Path::new(&zip_path);
    let bytes = PluginLoader::read_file_from_zip(path, &file_name)?;
    String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {}", e))
}

#[tauri::command]
async fn read_plugin_binary_command(
    zip_path: String,
    file_name: String,
) -> Result<Vec<u8>, String> {
    log::info!(
        "command.read_plugin_binary: zip={} file={}",
        zip_path,
        file_name
    );
    let path = Path::new(&zip_path);
    PluginLoader::read_file_from_zip(path, &file_name)
}

#[tauri::command]
async fn enable_plugin_command(plugin_id: String) -> Result<(), String> {
    log::info!("command.enable_plugin: start id={}", plugin_id);
    let mut config = Config::load().unwrap_or_default();
    if !config.enabled_plugins.contains(&plugin_id) {
        config.enabled_plugins.push(plugin_id.clone());
        config.save().map_err(|e| e.to_string())?;
        log::info!("command.enable_plugin: enabled id={}", plugin_id);
    } else {
        log::debug!("command.enable_plugin: already_enabled id={}", plugin_id);
    }
    Ok(())
}

#[tauri::command]
async fn disable_plugin_command(plugin_id: String) -> Result<(), String> {
    log::info!("command.disable_plugin: start id={}", plugin_id);
    let mut config = Config::load().unwrap_or_default();
    config.enabled_plugins.retain(|id| id != &plugin_id);
    config.save().map_err(|e| e.to_string())?;
    log::info!("command.disable_plugin: disabled id={}", plugin_id);
    Ok(())
}

#[tauri::command]
async fn get_plugin_config_command(plugin_id: String) -> Result<serde_json::Value, String> {
    log::info!("command.get_plugin_config: id={}", plugin_id);
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
    log::info!("command.set_plugin_config: id={}", plugin_id);
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
    log::info!(
        "command.plugin_file_op: operation={} path={}",
        operation,
        path
    );
    match operation.as_str() {
        "mkdir" => create_dirs_if_not_exist(Path::new(&path)).map_err(|e| e.to_string()),
        "write" => {
            let data = data.ok_or("No data provided for write operation")?;
            std::fs::write(Path::new(&path), data).map_err(|e| e.to_string())
        }
        _ => Err(format!("Unknown file operation: {}", operation)),
    }
}

#[tauri::command]
async fn frontend_log_command(
    level: String,
    message: String,
    target: Option<String>,
) -> Result<(), String> {
    let target = target.unwrap_or_else(|| "frontend".to_string());
    match level.as_str() {
        "error" => log::error!(target: target.as_str(), "{}", message),
        "warn" => log::warn!(target: target.as_str(), "{}", message),
        "info" => log::info!(target: target.as_str(), "{}", message),
        "debug" => log::debug!(target: target.as_str(), "{}", message),
        "trace" => log::trace!(target: target.as_str(), "{}", message),
        _ => return Err(format!("Unknown log level: {}", level)),
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log::info!("app.startup: begin");
    let exe_path = match current_exe() {
        Ok(path) => path,
        Err(e) => {
            log::error!("app.startup: failed current_exe err={}", e);
            return;
        }
    };
    let exe_dir = match exe_path.parent() {
        Some(dir) => dir,
        None => {
            log::error!("app.startup: failed exe parent directory");
            return;
        }
    };

    tauri::Builder::default()
        // NOTE 这个插件会在大小达到限制后立刻切分文件，很可能导致同义词运行的日志被切分在两个不同的文件中
        .plugin(
            tauri_plugin_log::Builder::new()
                .clear_targets()
                .target(Target::new(TargetKind::Folder {
                    path: PathBuf::from(exe_dir.join("logs")),
                    file_name: None,
                }))
                .level(log::LevelFilter::Trace)
                .max_file_size(5_000_000_000 /* bytes */)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .build(),
        )
        .setup(|_app| {
            let timestamp_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            log::info!("============================================================");
            log::info!(
                "app.run: start version={} timestamp_ms={}",
                env!("CARGO_PKG_VERSION"),
                timestamp_ms
            );
            log::info!("============================================================");
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory_command,
            get_thumbnail_command,
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
            frontend_log_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
