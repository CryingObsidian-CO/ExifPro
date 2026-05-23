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
