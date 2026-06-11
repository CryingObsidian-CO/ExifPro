pub mod config;
pub mod database;
pub mod exif;
pub mod file_ops;
pub mod grouping;
pub mod plugin;
pub mod selection;

use crate::config::Config;
use crate::database::Database;
use crate::exif::{get_thumbnail_data, parse_exif, ExifInfo};
use crate::file_ops::{create_dirs_if_not_exist, safe_copy, safe_move, scan_directory};
use crate::grouping::{group_photos, Group};
use crate::plugin::loader::PluginLoader;
use crate::plugin::manifest::PluginInfo;
use serde::{Deserialize, Serialize};
use std::env::current_exe;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_log::{log, Target, TargetKind};

fn ensure_valid_plugin_id(plugin_id: &str) -> Result<(), String> {
    if plugin_id.contains('\\') {
        return Err("Plugin id must not contain path separators".to_string());
    }
    let mut components = Path::new(plugin_id).components();
    let first = components
        .next()
        .ok_or_else(|| "Plugin id must not be empty".to_string())?;
    if components.next().is_some() {
        return Err("Plugin id must not contain path separators".to_string());
    }
    match first {
        Component::Normal(_) => Ok(()),
        _ => Err("Plugin id contains invalid path components".to_string()),
    }
}

fn plugin_data_root(plugin_id: &str) -> Result<PathBuf, String> {
    ensure_valid_plugin_id(plugin_id)?;
    let exe_dir = current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or_else(|| "Failed to get exe directory".to_string())?
        .to_path_buf();
    let root = exe_dir.join("plugin_data").join(plugin_id);
    create_dirs_if_not_exist(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

fn resolve_plugin_path(plugin_id: &str, path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty() {
        return Err("Path must not be empty".to_string());
    }
    if path.contains('\\') {
        return Err("Absolute paths are not allowed".to_string());
    }
    let rel_path = Path::new(path);
    if rel_path.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }
    let mut safe_rel = PathBuf::new();
    for component in rel_path.components() {
        match component {
            Component::Normal(part) => safe_rel.push(part),
            _ => {
                return Err("Path traversal is not allowed".to_string());
            }
        }
    }
    if safe_rel.as_os_str().is_empty() {
        return Err("Path must not be empty".to_string());
    }
    Ok(plugin_data_root(plugin_id)?.join(safe_rel))
}

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
async fn get_thumbnail_command(file_path: String, level: String) -> Result<Option<String>, String> {
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
    plugin_id: String,
    operation: String,
    path: String,
    data: Option<Vec<u8>>,
) -> Result<Vec<u8>, String> {
    log::info!(
        "command.plugin_file_op: plugin={} operation={} path={}",
        plugin_id,
        operation,
        path
    );

    PluginLoader::check_plugin_file_capability(&plugin_id, &operation)?;
    let resolved_path = resolve_plugin_path(&plugin_id, &path)?;
    match operation.as_str() {
        "read" => std::fs::read(&resolved_path).map_err(|e| e.to_string()),
        "mkdir" => {
            create_dirs_if_not_exist(&resolved_path).map_err(|e| e.to_string())?;
            Ok(Vec::new())
        }
        "write" => {
            let data = data.ok_or("No data provided for write operation")?;
            if let Some(parent) = resolved_path.parent() {
                create_dirs_if_not_exist(parent).map_err(|e| e.to_string())?;
            }
            std::fs::write(&resolved_path, data).map_err(|e| e.to_string())?;
            Ok(Vec::new())
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

#[tauri::command]
async fn detect_command(
    path: String,
    recursive: bool,
    algorithm: String,
    threshold: f32,
    noise_bias: selection::NoiseBias,
) -> Result<Vec<selection::SelectionResult>, String> {
    log::info!(
        "command.detect: start path={} recursive={} algorithm={} threshold={} noise_bias={:?}",
        path,
        recursive,
        algorithm,
        threshold,
        noise_bias
    );
    let dir = PathBuf::from(&path);
    let alg = selection::convert_algorithm(&algorithm)?;
    let files = scan_directory(&dir, recursive).await?;
    log::info!("command.detect: scanned {} files", files.len());

    let result = tauri::async_runtime::spawn_blocking(move || {
        selection::detect::process_images(files, alg, threshold, noise_bias)
    })
    .await
    .map_err(|e| format!("Failed to join detection task: {}", e))?;

    log::info!("command.detect: complete results={}", result.len());
    Ok(result)
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
        Some(dir) => dir.to_path_buf(),
        None => {
            log::error!("app.startup: failed exe parent directory");
            return;
        }
    };

    tauri::Builder::default()
        // DEBUG 日志在记录的时候不能保证严格有序，尤其是短时间同时写入日志的情况
        // NOTE 这个插件会在大小达到限制后立刻切分文件，很可能导致同义词运行的日志被切分在两个不同的文件中
        .plugin(
            tauri_plugin_log::Builder::new()
                .clear_targets()
                .target(Target::new(TargetKind::Folder {
                    path: exe_dir.join("logs"),
                    file_name: None,
                }))
                .level(log::LevelFilter::Trace)
                .max_file_size(5_000_000 /* bytes */)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .build(),
        )
        .setup(move |app| {
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

            let db_dir = exe_dir.join("data");
            create_dirs_if_not_exist(&db_dir).expect("Failed to create database directory");
            let db_path = db_dir.join("exifPro.db");
            let db = tauri::async_runtime::block_on(Database::new(&db_path, 4))
                .expect("Failed to initialize database");
            app.manage(db);

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory_command,
            get_thumbnail_command,
            detect_command,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grouping::GroupType;
    use std::io::Write;
    use std::sync::Mutex;

    static CONFIG_MUTEX: Mutex<()> = Mutex::new(());

    struct TestDir {
        path: PathBuf,
    }

    impl TestDir {
        fn new() -> Self {
            let base = std::env::temp_dir();
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = base.join(format!("lib_test_{}", ts));
            std::fs::create_dir_all(&path).unwrap();
            TestDir { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    fn clean_config() {
        let exe = std::env::current_exe().unwrap();
        if let Some(parent) = exe.parent() {
            let _ = std::fs::remove_file(parent.join("config.json"));
        }
    }

    #[test]
    fn test_ensure_valid_plugin_id_valid() {
        assert!(ensure_valid_plugin_id("my-plugin").is_ok());
    }

    #[test]
    fn test_ensure_valid_plugin_id_empty() {
        let result = ensure_valid_plugin_id("");
        assert!(result.is_err());
    }

    #[test]
    fn test_ensure_valid_plugin_id_path_separator() {
        let result = ensure_valid_plugin_id("a/b");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path separators"));
    }

    #[test]
    fn test_ensure_valid_plugin_id_backslash() {
        let result = ensure_valid_plugin_id("a\\b");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path separators"));
    }

    #[test]
    fn test_ensure_valid_plugin_id_dot_component() {
        let result = ensure_valid_plugin_id(".");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid path components"));
    }

    #[test]
    fn test_ensure_valid_plugin_id_dotdot() {
        let result = ensure_valid_plugin_id("..");
        assert!(result.is_err());
    }

    #[test]
    fn test_resolve_plugin_path_valid() {
        let result = resolve_plugin_path("test-plugin", "sub/file.txt");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with("plugin_data/test-plugin/sub/file.txt"));
    }

    #[test]
    fn test_resolve_plugin_path_empty_plugin_id() {
        let result = resolve_plugin_path("", "file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_resolve_plugin_path_empty_path() {
        let result = resolve_plugin_path("test-plugin", "");
        assert!(result.is_err());
    }

    #[test]
    fn test_resolve_plugin_path_whitespace_path() {
        let result = resolve_plugin_path("test-plugin", "  ");
        assert!(result.is_err());
    }

    #[test]
    fn test_resolve_plugin_path_absolute_windows() {
        let result = resolve_plugin_path("test-plugin", "C:\\windows\\system32");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Absolute"));
    }

    #[test]
    #[cfg(unix)]
    fn test_resolve_plugin_path_absolute_unix() {
        let result = resolve_plugin_path("test-plugin", "/etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Absolute"));
    }

    #[test]
    fn test_resolve_plugin_path_traversal() {
        let result = resolve_plugin_path("test-plugin", "../escape.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));
    }

    #[test]
    fn test_resolve_plugin_path_deep_traversal() {
        let result = resolve_plugin_path("test-plugin", "sub/../../escape.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_resolve_plugin_path_plugin_id_with_separator() {
        let result = resolve_plugin_path("a/b", "file.txt");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_reset_config_command() {
        let config = reset_config_command().await;
        assert_eq!(config.preview_max_mb, 8);
        assert_eq!(config.sub_second_digits, 3);
    }

    #[tokio::test]
    async fn test_frontend_log_command_invalid_level() {
        let result = frontend_log_command("invalid".to_string(), "msg".to_string(), None).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown log level"));
    }

    #[tokio::test]
    async fn test_frontend_log_command_valid_levels() {
        for level in &["error", "warn", "info", "debug", "trace"] {
            let result = frontend_log_command((*level).to_string(), "test".to_string(), None).await;
            assert!(result.is_ok(), "level={} should be ok", level);
        }
    }

    #[test]
    fn test_plugin_data_root_valid() {
        let result = plugin_data_root("my-plugin");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(
            path.ends_with("plugin_data\\my-plugin") || path.ends_with("plugin_data/my-plugin")
        );
    }

    #[test]
    fn test_plugin_data_root_invalid_plugin_id() {
        let result = plugin_data_root("../escape");
        assert!(result.is_err());
    }

    #[test]
    fn test_plugin_data_root_empty_id() {
        let result = plugin_data_root("");
        assert!(result.is_err());
    }

    #[test]
    fn test_script_result_serde() {
        let sr = ScriptResult {
            exit_code: 0,
            stdout: "hello".to_string(),
            stderr: "".to_string(),
        };
        let json = serde_json::to_string(&sr).expect("serialize");
        let parsed: ScriptResult = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed.exit_code, 0);
        assert_eq!(parsed.stdout, "hello");
        assert_eq!(parsed.stderr, "");
    }

    // --- Command Tests ---

    #[tokio::test]
    async fn test_scan_directory_command_basic() {
        let dir = TestDir::new();
        std::fs::write(dir.path().join("a.jpg"), b"fake").unwrap();
        std::fs::write(dir.path().join("b.png"), b"fake").unwrap();
        std::fs::write(dir.path().join("c.txt"), b"ignore").unwrap();

        let result = scan_directory_command(dir.path().to_string_lossy().to_string(), false).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_scan_directory_command_nonexistent() {
        let result =
            scan_directory_command("C:\\ definitely_not_exists_xyz".to_string(), false).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to scan directory"));
    }

    #[tokio::test]
    async fn test_get_thumbnail_command_invalid_level() {
        let result = get_thumbnail_command("some_path.jpg".to_string(), "bad".to_string()).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_get_thumbnail_command_nonexistent_file() {
        let result = get_thumbnail_command(
            "C:\\ definitely_not_exists.jpg".to_string(),
            "high".to_string(),
        )
        .await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_group_photos_command_default_config() {
        let photos = vec![ExifInfo {
            file_path: "/a.jpg".to_string(),
            file_name: "a.jpg".to_string(),
            capture_time: Some("2024:01:15 10:30:00".to_string()),
            sub_time: Some("000000".to_string()),
            offset_time_original: None,
            shutter_speed: None,
            aperture: None,
            iso: None,
            exposure_compensation: None,
            exposure_mode: None,
            focal_length: None,
            focus_distance: None,
            camera_make: None,
            camera_model: None,
        }];
        let result = group_photos_command(photos, None).await;
        assert!(result.is_ok());
        let groups = result.unwrap();
        assert_eq!(groups.len(), 1); // single photo goes to ungrouped
    }

    #[tokio::test]
    async fn test_group_photos_command_with_config() {
        let photos = vec![];
        let config = Config::default();
        let result = group_photos_command(photos, Some(config)).await;
        assert!(result.is_ok());
        let groups = result.unwrap();
        assert_eq!(groups.len(), 1); // only ungrouped
    }

    #[tokio::test]
    async fn test_save_config_command() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let config = Config::default();
        let result = save_config_command(config).await;
        assert!(result.is_ok());

        // Verify file was created
        let loaded = Config::load().unwrap();
        assert_eq!(loaded.preview_max_mb, 8);

        clean_config();
    }

    #[tokio::test]
    async fn test_load_config_command() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let result = load_config_command().await;
        assert!(result.is_ok());
        let config = result.unwrap();
        assert_eq!(config.preview_max_mb, 8);

        clean_config();
    }

    #[tokio::test]
    async fn test_organize_files_command_copy() {
        let src_dir = TestDir::new();
        let dst_dir = TestDir::new();
        let src_file = src_dir.path().join("photo.jpg");
        std::fs::write(&src_file, b"data").unwrap();

        let photo = ExifInfo {
            file_path: src_file.to_string_lossy().to_string(),
            file_name: "photo.jpg".to_string(),
            capture_time: None,
            sub_time: None,
            offset_time_original: None,
            shutter_speed: None,
            aperture: None,
            iso: None,
            exposure_compensation: None,
            exposure_mode: None,
            focal_length: None,
            focus_distance: None,
            camera_make: None,
            camera_model: None,
        };
        let group = Group {
            name: "test_group".to_string(),
            group_type: GroupType::Single,
            photos: vec![photo],
            id: "g1".to_string(),
        };

        let result = organize_files_command(
            vec![group],
            dst_dir.path().to_string_lossy().to_string(),
            true,
            false,
        )
        .await;
        assert!(result.is_ok());
        assert!(dst_dir.path().join("test_group").join("photo.jpg").exists());
    }

    #[tokio::test]
    async fn test_organize_files_command_move() {
        let src_dir = TestDir::new();
        let dst_dir = TestDir::new();
        let src_file = src_dir.path().join("move_me.jpg");
        std::fs::write(&src_file, b"data").unwrap();

        let photo = ExifInfo {
            file_path: src_file.to_string_lossy().to_string(),
            file_name: "move_me.jpg".to_string(),
            capture_time: None,
            sub_time: None,
            offset_time_original: None,
            shutter_speed: None,
            aperture: None,
            iso: None,
            exposure_compensation: None,
            exposure_mode: None,
            focal_length: None,
            focus_distance: None,
            camera_make: None,
            camera_model: None,
        };
        let group = Group {
            name: "moved".to_string(),
            group_type: GroupType::Single,
            photos: vec![photo],
            id: "g1".to_string(),
        };

        let result = organize_files_command(
            vec![group],
            dst_dir.path().to_string_lossy().to_string(),
            false,
            false,
        )
        .await;
        assert!(result.is_ok());
        assert!(dst_dir.path().join("moved").join("move_me.jpg").exists());
        assert!(!src_file.exists());
    }

    #[tokio::test]
    async fn test_list_plugins_command() {
        let result = list_plugins_command().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_read_plugin_file_command() {
        let dir = TestDir::new();
        let zip_path = dir.path().join("plugin.zip");

        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();
            zip.start_file("hello.txt", options).unwrap();
            zip.write_all(b"Hello, World!").unwrap();
            zip.finish().unwrap();
        }

        let result = read_plugin_file_command(
            zip_path.to_string_lossy().to_string(),
            "hello.txt".to_string(),
        )
        .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Hello, World!");
    }

    #[tokio::test]
    async fn test_read_plugin_binary_command() {
        let dir = TestDir::new();
        let zip_path = dir.path().join("binary.zip");

        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();
            zip.start_file("data.bin", options).unwrap();
            zip.write_all(&[0x00, 0x01, 0xFF]).unwrap();
            zip.finish().unwrap();
        }

        let result = read_plugin_binary_command(
            zip_path.to_string_lossy().to_string(),
            "data.bin".to_string(),
        )
        .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), vec![0x00, 0x01, 0xFF]);
    }

    #[tokio::test]
    async fn test_enable_disable_plugin_command() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let result = enable_plugin_command("test-plugin".to_string()).await;
        assert!(result.is_ok());

        // verify it persisted
        let config = Config::load().unwrap();
        assert!(config.enabled_plugins.contains(&"test-plugin".to_string()));

        let result = disable_plugin_command("test-plugin".to_string()).await;
        assert!(result.is_ok());

        let config = Config::load().unwrap();
        assert!(!config.enabled_plugins.contains(&"test-plugin".to_string()));

        clean_config();
    }

    #[tokio::test]
    async fn test_enable_plugin_command_already_enabled() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        enable_plugin_command("dup-plugin".to_string())
            .await
            .unwrap();
        let result = enable_plugin_command("dup-plugin".to_string()).await;
        assert!(result.is_ok());

        let config = Config::load().unwrap();
        assert_eq!(
            config
                .enabled_plugins
                .iter()
                .filter(|id| *id == "dup-plugin")
                .count(),
            1
        );

        clean_config();
    }

    #[tokio::test]
    async fn test_get_plugin_config_command() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let result = get_plugin_config_command("my-plugin".to_string()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), serde_json::Value::Null);

        clean_config();
    }

    #[tokio::test]
    async fn test_set_and_get_plugin_config_command() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let value = serde_json::json!({"key": "value"});
        let result = set_plugin_config_command("my-plugin".to_string(), value.clone()).await;
        assert!(result.is_ok());

        let fetched = get_plugin_config_command("my-plugin".to_string()).await;
        assert!(fetched.is_ok());
        assert_eq!(fetched.unwrap(), value);

        clean_config();
    }

    #[tokio::test]
    async fn test_plugin_file_op_command_read_nonexistent() {
        let result = plugin_file_op_command(
            "test-plugin".to_string(),
            "read".to_string(),
            "nonexistent.txt".to_string(),
            None,
        )
        .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_plugin_file_op_command_mkdir() {
        let dir = TestDir::new();
        let sub_path = dir.path().join("new_dir");
        let result = plugin_file_op_command(
            "test-plugin".to_string(),
            "mkdir".to_string(),
            sub_path.to_string_lossy().to_string(),
            None,
        )
        .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_plugin_file_op_command_unknown_operation() {
        let result = plugin_file_op_command(
            "test-plugin".to_string(),
            "unknown".to_string(),
            "file.txt".to_string(),
            None,
        )
        .await;
        assert!(result.is_err());
    }
}
