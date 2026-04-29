use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const CURRENT_API_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub version: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    pub api_version: u32,
    pub entry_point: String,
    pub capabilities: PluginCapabilities,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
    #[serde(default)]
    pub config_schema: HashMap<String, ConfigSchemaItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCapabilities {
    pub grouping: bool,
    pub merging: bool,
    pub exif_enhancement: bool,
    #[serde(default)]
    pub custom_group_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSchemaItem {
    #[serde(rename = "type")]
    pub item_type: String,
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub min: Option<serde_json::Value>,
    #[serde(default)]
    pub max: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub enabled: bool,
    pub zip_path: String,
}

impl PluginManifest {
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Plugin id cannot be empty".to_string());
        }
        if self.version.is_empty() {
            return Err("Plugin version cannot be empty".to_string());
        }
        if self.name.is_empty() {
            return Err("Plugin name cannot be empty".to_string());
        }
        if self.entry_point.is_empty() {
            return Err("Plugin entry_point cannot be empty".to_string());
        }
        if self.api_version != CURRENT_API_VERSION {
            return Err(format!(
                "Incompatible api_version: expected {}, got {}",
                CURRENT_API_VERSION, self.api_version
            ));
        }
        Ok(())
    }
}
