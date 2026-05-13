use std::env::current_exe;
use crate::plugin::manifest::PluginManifest;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use zip::ZipArchive;

pub struct PluginLoader;

pub struct DiscoveredPlugin {
    pub zip_path: PathBuf,
    pub manifest: PluginManifest,
    pub builtin: bool,
}

impl PluginLoader {
    pub fn discover_plugins() -> Result<Vec<DiscoveredPlugin>, String> {
        let mut plugins = Self::discover_builtin_plugins();
        let mut zip_plugins = Self::discover_zip_plugins()?;
        plugins.append(&mut zip_plugins);
        Ok(plugins)
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
        if !plugins_dir.exists() {
            fs::create_dir_all(&plugins_dir)
                .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
            return Ok(vec![]);
        }

        let mut plugins = Vec::new();
        for entry in fs::read_dir(&plugins_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("zip") {
                match Self::load_manifest_from_zip(&path) {
                    Ok(manifest) => plugins.push(DiscoveredPlugin {
                        zip_path: path,
                        manifest,
                        builtin: false,
                    }),
                    Err(e) => {
                        eprintln!("Warning: Failed to load plugin from {:?}: {}", path, e)
                    }
                }
            }
        }
        Ok(plugins)
    }

    pub fn load_manifest_from_zip(zip_path: &Path) -> Result<PluginManifest, String> {
        let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|e| format!("manifest.json not found: {}", e))?;
        let mut manifest_str = String::new();
        manifest_file
            .read_to_string(&mut manifest_str)
            .map_err(|e| e.to_string())?;

        let manifest: PluginManifest = serde_json::from_str(&manifest_str)
            .map_err(|e| format!("Invalid manifest.json: {}", e))?;

        manifest.validate()?;
        Ok(manifest)
    }

    pub fn read_file_from_zip(zip_path: &Path, file_name: &str) -> Result<Vec<u8>, String> {
        let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

        let mut entry = archive
            .by_name(file_name)
            .map_err(|e| format!("File '{}' not found in zip: {}", file_name, e))?;
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        Ok(buf)
    }
}
