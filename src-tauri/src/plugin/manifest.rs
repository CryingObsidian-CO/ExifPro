use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri_plugin_log::log;

pub const CURRENT_API_VERSION: u32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub version: String,
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub api_version: u32,
    pub entry_point: String,
    pub capabilities: PluginCapabilities,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
    #[serde(default)]
    pub config_schema: IndexMap<String, ConfigSchemaItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCapabilities {
    #[serde(default)]
    pub exif_enhancement: bool,
    #[serde(default)]
    pub grouping: bool,
    #[serde(default)]
    pub merging: bool,
    #[serde(default)]
    pub ui_extensions: bool,
    #[serde(default)]
    pub file_read: bool,
    #[serde(default)]
    pub file_write: bool,
    #[serde(default)]
    pub directory_create: bool,
    #[serde(default)]
    pub custom_capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSchemaItem {
    #[serde(rename = "type")]
    pub item_type: String,
    pub default: Option<serde_json::Value>,
    pub description: Option<String>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub step: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub enabled: bool,
    pub zip_path: String,
    pub builtin: bool,
}

impl PluginManifest {
    pub fn validate(&self) -> Result<(), String> {
        log::debug!(
            "plugin.manifest.validate: start id={} version={} api_version={}",
            self.id,
            self.version,
            self.api_version
        );
        if self.id.is_empty() {
            log::error!("plugin.manifest.validate: failed reason=empty_id");
            return Err("Plugin id cannot be empty".to_string());
        }
        if self.version.is_empty() {
            log::error!(
                "plugin.manifest.validate: failed reason=empty_version id={}",
                self.id
            );
            return Err("Plugin version cannot be empty".to_string());
        }
        if self.name.is_empty() {
            log::error!(
                "plugin.manifest.validate: failed reason=empty_name id={}",
                self.id
            );
            return Err("Plugin name cannot be empty".to_string());
        }
        if self.entry_point.is_empty() {
            log::error!(
                "plugin.manifest.validate: failed reason=empty_entry_point id={}",
                self.id
            );
            return Err("Plugin entry_point cannot be empty".to_string());
        }
        if self.api_version != CURRENT_API_VERSION {
            log::error!(
                "plugin.manifest.validate: failed reason=api_version_mismatch id={} expected={} got={}",
                self.id,
                CURRENT_API_VERSION,
                self.api_version
            );
            return Err(format!(
                "Incompatible api_version: expected {}, got {}",
                CURRENT_API_VERSION, self.api_version
            ));
        }
        log::info!(
            "plugin.manifest.validate: complete id={} version={}",
            self.id,
            self.version
        );
        Ok(())
    }
}

impl PluginCapabilities {
    pub fn has_file_read(&self) -> bool {
        self.file_read
    }

    pub fn has_file_write(&self) -> bool {
        self.file_write
    }

    pub fn has_directory_create(&self) -> bool {
        self.directory_create
    }
}
