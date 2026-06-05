use crate::plugin::manifest::PluginManifest;
use std::env::current_exe;
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use tauri_plugin_log::log;
use zip::ZipArchive;

pub struct PluginLoader;

#[derive(Clone)]
pub struct DiscoveredPlugin {
    pub zip_path: PathBuf,
    pub manifest: PluginManifest,
    pub builtin: bool,
}

static PLUGIN_CACHE: OnceLock<Vec<DiscoveredPlugin>> = OnceLock::new();

impl PluginLoader {
    fn cached_discover() -> Result<&'static Vec<DiscoveredPlugin>, String> {
        if let Some(plugins) = PLUGIN_CACHE.get() {
            return Ok(plugins);
        }

        log::info!("plugin.discover: start (cache miss)");
        let mut plugins = Self::discover_builtin_plugins();
        log::debug!("plugin.discover: builtin_count={}", plugins.len());
        let mut zip_plugins = Self::discover_zip_plugins()?;
        log::debug!("plugin.discover: zip_count={}", zip_plugins.len());
        plugins.append(&mut zip_plugins);
        log::info!("plugin.discover: complete total={} (cached)", plugins.len());

        let _ = PLUGIN_CACHE.set(plugins);
        Ok(PLUGIN_CACHE.get().unwrap())
    }

    pub fn discover_plugins() -> Result<Vec<DiscoveredPlugin>, String> {
        Self::cached_discover().map(|v| v.clone())
    }

    pub fn discover_builtin_plugins() -> Vec<DiscoveredPlugin> {
        crate::plugin::get_builtin_plugin_manifests()
            .into_iter()
            .map(|manifest| DiscoveredPlugin {
                zip_path: PathBuf::from("__builtin__"),
                manifest,
                builtin: true,
            })
            .collect()
    }

    pub fn discover_zip_plugins() -> Result<Vec<DiscoveredPlugin>, String> {
        let exe_dir = current_exe()
            .map_err(|e| e.to_string())?
            .parent()
            .ok_or("Failed to get exe directory")?
            .to_path_buf();

        let plugins_dir = exe_dir.join("plugins");
        log::debug!("plugin.discover_zip: dir={}", plugins_dir.display());
        if !plugins_dir.exists() {
            log::info!(
                "plugin.discover_zip: dir_missing create=true dir={}",
                plugins_dir.display()
            );
            fs::create_dir_all(&plugins_dir)
                .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
            return Ok(vec![]);
        }

        let mut plugins = Vec::new();
        let mut entries_scanned = 0u32;
        for entry in fs::read_dir(&plugins_dir).map_err(|e| {
            log::error!(
                "plugin.discover_zip: read_dir_failed dir={} err={}",
                plugins_dir.display(),
                e
            );
            e.to_string()
        })? {
            let entry = entry.map_err(|e| e.to_string())?;
            entries_scanned += 1;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("zip") {
                log::info!("plugin.discover_zip: load_zip path={}", path.display());
                match Self::load_manifest_from_zip(&path) {
                    Ok(manifest) => {
                        log::info!(
                            "plugin.discover_zip: loaded path={} id={} version={}",
                            path.display(),
                            manifest.id,
                            manifest.version
                        );
                        plugins.push(DiscoveredPlugin {
                            zip_path: path,
                            manifest,
                            builtin: false,
                        })
                    }
                    Err(e) => {
                        log::error!(
                            "plugin.discover_zip: load_failed path={} err={}",
                            path.display(),
                            e
                        )
                    }
                }
            } else {
                log::debug!("plugin.discover_zip: skip_non_zip path={}", path.display());
            }
        }
        log::debug!(
            "plugin.discover_zip: complete entries={} zips={}",
            entries_scanned,
            plugins.len()
        );
        Ok(plugins)
    }

    pub fn load_manifest_from_zip(zip_path: &Path) -> Result<PluginManifest, String> {
        log::debug!("plugin.manifest: load_zip path={}", zip_path.display());
        let file = fs::File::open(zip_path).map_err(|e| {
            log::error!(
                "plugin.manifest: open_zip_failed path={} err={}",
                zip_path.display(),
                e
            );
            e.to_string()
        })?;
        let mut archive = ZipArchive::new(file).map_err(|e| {
            log::error!(
                "plugin.manifest: open_archive_failed path={} err={}",
                zip_path.display(),
                e
            );
            e.to_string()
        })?;

        let mut manifest_file = archive.by_name("manifest.json").map_err(|e| {
            log::warn!(
                "plugin.manifest: missing_manifest path={} err={}",
                zip_path.display(),
                e
            );
            format!("manifest.json not found: {}", e)
        })?;
        let mut manifest_str = String::new();
        manifest_file
            .read_to_string(&mut manifest_str)
            .map_err(|e| {
                log::error!(
                    "plugin.manifest: read_failed path={} err={}",
                    zip_path.display(),
                    e
                );
                e.to_string()
            })?;

        let manifest: PluginManifest = serde_json::from_str(&manifest_str).map_err(|e| {
            log::error!(
                "plugin.manifest: parse_failed path={} err={}",
                zip_path.display(),
                e
            );
            format!("Invalid manifest.json: {}", e)
        })?;

        manifest.validate()?;
        log::debug!(
            "plugin.manifest: validated id={} version={}",
            manifest.id,
            manifest.version
        );
        Ok(manifest)
    }

    pub fn read_file_from_zip(zip_path: &Path, file_name: &str) -> Result<Vec<u8>, String> {
        log::info!(
            "plugin.zip_read: start path={} file={}",
            zip_path.display(),
            file_name
        );
        let file = fs::File::open(zip_path).map_err(|e| {
            log::error!(
                "plugin.zip_read: open_failed path={} err={}",
                zip_path.display(),
                e
            );
            e.to_string()
        })?;
        let mut archive = ZipArchive::new(file).map_err(|e| {
            log::error!(
                "plugin.zip_read: open_archive_failed path={} err={}",
                zip_path.display(),
                e
            );
            e.to_string()
        })?;

        Self::validate_zip_entry_path(file_name)?;
        let mut entry = archive
            .by_name(file_name)
            .map_err(|e| format!("File '{}' not found in zip: {}", file_name, e))?;
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        log::debug!(
            "plugin.zip_read: complete file={} size={}",
            file_name,
            buf.len()
        );
        Ok(buf)
    }

    pub fn check_plugin_file_capability(plugin_id: &str, operation: &str) -> Result<(), String> {
        let plugins =
            Self::cached_discover().map_err(|e| format!("Failed to discover plugins: {}", e))?;

        let plugin = plugins
            .into_iter()
            .find(|p| p.manifest.id == plugin_id)
            .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

        let capabilities = &plugin.manifest.capabilities;

        match operation {
            "read" => {
                if !capabilities.has_file_read() {
                    log::error!(
                        "command.plugin_file_op: capability_denied plugin={} operation={}",
                        plugin_id,
                        operation
                    );
                    return Err(format!(
                        "Plugin {} does not have file_read capability",
                        plugin_id
                    ));
                }
            }
            "write" => {
                if !capabilities.has_file_write() {
                    log::error!(
                        "command.plugin_file_op: capability_denied plugin={} operation={}",
                        plugin_id,
                        operation
                    );
                    return Err(format!(
                        "Plugin {} does not have file_write capability",
                        plugin_id
                    ));
                }
            }
            "mkdir" => {
                if !capabilities.has_directory_create() {
                    log::error!(
                        "command.plugin_file_op: capability_denied plugin={} operation={}",
                        plugin_id,
                        operation
                    );
                    return Err(format!(
                        "Plugin {} does not have directory_create capability",
                        plugin_id
                    ));
                }
            }
            _ => {}
        }

        Ok(())
    }

    fn validate_zip_entry_path(file_name: &str) -> Result<(), String> {
        if file_name.trim().is_empty() {
            return Err("Zip entry path must not be empty".to_string());
        }
        if file_name.contains('\\') {
            return Err("Absolute zip entry paths are not allowed".to_string());
        }
        let path = Path::new(file_name);
        if path.is_absolute() {
            return Err("Absolute zip entry paths are not allowed".to_string());
        }
        for component in path.components() {
            match component {
                Component::Normal(_) => {}
                _ => return Err("Invalid zip entry path".to_string()),
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    struct TestTempDir(std::path::PathBuf);

    impl TestTempDir {
        fn new() -> Self {
            let base = std::env::temp_dir();
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = base.join(format!("loader_test_{}", ts));
            std::fs::create_dir_all(&path).unwrap();
            TestTempDir(path)
        }

        fn path(&self) -> &std::path::Path {
            &self.0
        }
    }

    impl Drop for TestTempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn test_discover_builtin_plugins() {
        let plugins = PluginLoader::discover_builtin_plugins();
        assert!(plugins.is_empty());
    }

    #[test]
    fn test_check_plugin_file_capability_not_found() {
        let result = PluginLoader::check_plugin_file_capability("nonexistent", "read");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_load_manifest_from_zip_valid() {
        let dir = TestTempDir::new();
        let zip_path = dir.path().join("test_plugin.zip");

        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();

            zip.start_file("manifest.json", options).unwrap();
            zip.write_all(
                br#"{
                    "id": "test-plugin",
                    "version": "1.0.0",
                    "name": "Test Plugin",
                    "api_version": 2,
                    "entry_point": "index.ts",
                    "capabilities": {}
                }"#,
            )
            .unwrap();
            zip.finish().unwrap();
        }

        let manifest = PluginLoader::load_manifest_from_zip(&zip_path).unwrap();
        assert_eq!(manifest.id, "test-plugin");
        assert_eq!(manifest.version, "1.0.0");
        assert_eq!(manifest.name, "Test Plugin");
        assert_eq!(manifest.entry_point, "index.ts");
    }

    #[test]
    fn test_load_manifest_from_zip_nonexistent() {
        let result = PluginLoader::load_manifest_from_zip(std::path::Path::new(
            "C:\\ definitely_not_exists.zip",
        ));
        assert!(result.is_err());
    }

    #[test]
    fn test_load_manifest_from_zip_missing_manifest() {
        let dir = TestTempDir::new();
        let zip_path = dir.path().join("empty.zip");

        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();

            zip.start_file("other.txt", options).unwrap();
            zip.write_all(b"not a manifest").unwrap();
            zip.finish().unwrap();
        }

        let result = PluginLoader::load_manifest_from_zip(&zip_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("manifest.json not found"));
    }

    #[test]
    fn test_read_file_from_zip_valid() {
        let dir = TestTempDir::new();
        let zip_path = dir.path().join("data.zip");

        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();

            zip.start_file("hello.txt", options).unwrap();
            zip.write_all(b"Hello, World!").unwrap();
            zip.finish().unwrap();
        }

        let data = PluginLoader::read_file_from_zip(&zip_path, "hello.txt").unwrap();
        assert_eq!(data, b"Hello, World!");
    }

    #[test]
    fn test_read_file_from_zip_nonexistent_file() {
        let dir = TestTempDir::new();
        let zip_path = dir.path().join("data.zip");

        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();
            zip.start_file("real.txt", options).unwrap();
            zip.write_all(b"data").unwrap();
            zip.finish().unwrap();
        }

        let result = PluginLoader::read_file_from_zip(&zip_path, "missing.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_load_manifest_from_zip_too_small_api_version() {
        let dir = TestTempDir::new();
        let zip_path = dir.path().join("bad_api.zip");

        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();

            zip.start_file("manifest.json", options).unwrap();
            zip.write_all(
                br#"{
                    "id": "old-plugin",
                    "version": "0.5.0",
                    "name": "Old Plugin",
                    "api_version": 1,
                    "entry_point": "index.ts",
                    "capabilities": {}
                }"#,
            )
            .unwrap();
            zip.finish().unwrap();
        }

        let result = PluginLoader::load_manifest_from_zip(&zip_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("api_version"));
    }

    #[test]
    fn test_validate_zip_entry_path_valid() {
        assert!(PluginLoader::validate_zip_entry_path("foo/bar.ts").is_ok());
    }

    #[test]
    fn test_validate_zip_entry_path_empty() {
        assert!(PluginLoader::validate_zip_entry_path("").is_err());
    }

    #[test]
    fn test_validate_zip_entry_path_whitespace() {
        assert!(PluginLoader::validate_zip_entry_path("   ").is_err());
    }

    #[test]
    fn test_validate_zip_entry_path_absolute_windows() {
        assert!(PluginLoader::validate_zip_entry_path("C:\\foo.ts").is_err());
    }

    #[test]
    fn test_validate_zip_entry_path_absolute_unix() {
        assert!(PluginLoader::validate_zip_entry_path("/etc/passwd").is_err());
    }

    #[test]
    fn test_validate_zip_entry_path_traversal() {
        assert!(PluginLoader::validate_zip_entry_path("../escape.ts").is_err());
    }

    #[test]
    fn test_validate_zip_entry_path_deep_traversal() {
        assert!(PluginLoader::validate_zip_entry_path("sub/../../escape.ts").is_err());
    }

    #[test]
    fn test_validate_zip_entry_path_single_file() {
        assert!(PluginLoader::validate_zip_entry_path("manifest.json").is_ok());
    }

    #[test]
    fn test_validate_zip_entry_path_nested() {
        assert!(PluginLoader::validate_zip_entry_path("sub/dir/file.ts").is_ok());
    }
}
