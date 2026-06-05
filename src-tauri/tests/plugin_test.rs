use exifpro_lib::plugin::manifest::{
    ConfigSchemaItem, PluginCapabilities, PluginManifest, CURRENT_API_VERSION,
};
use indexmap::IndexMap;
use std::collections::HashMap;

fn creat_manifest() -> PluginManifest {
    PluginManifest {
        id: "test-plugin".to_string(),
        version: "1.0.0".to_string(),
        name: "Test Plugin".to_string(),
        description: Some("A test plugin".to_string()),
        author: Some("Test Author".to_string()),
        api_version: CURRENT_API_VERSION,
        entry_point: "index.ts".to_string(),
        capabilities: PluginCapabilities {
            exif_enhancement: true,
            grouping: false,
            merging: false,
            ui_extensions: false,
            file_read: false,
            file_write: false,
            directory_create: false,
            custom_capabilities: vec![],
        },
        dependencies: HashMap::new(),
        config_schema: IndexMap::new(),
    }
}

#[test]
fn test_manifest_validate_valid() {
    let manifest = creat_manifest();
    assert!(manifest.validate().is_ok());
}

#[test]
fn test_manifest_validate_empty_id() {
    let mut manifest = creat_manifest();
    manifest.id = "".to_string();
    assert!(manifest.validate().is_err());
}

#[test]
fn test_manifest_validate_empty_version() {
    let mut manifest = creat_manifest();
    manifest.version = "".to_string();
    assert!(manifest.validate().is_err());
}

#[test]
fn test_manifest_validate_empty_name() {
    let mut manifest = creat_manifest();
    manifest.name = "".to_string();
    assert!(manifest.validate().is_err());
}

#[test]
fn test_manifest_validate_empty_entry_point() {
    let mut manifest = creat_manifest();
    manifest.entry_point = "".to_string();
    assert!(manifest.validate().is_err());
}

#[test]
fn test_manifest_validate_wrong_api_version() {
    let mut manifest = creat_manifest();
    manifest.api_version = 999;
    let result = manifest.validate();
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.contains("api_version"));
}

#[test]
fn test_manifest_validate_future_api_version() {
    let mut manifest = creat_manifest();
    manifest.api_version = CURRENT_API_VERSION + 100;
    assert!(manifest.validate().is_err());
}

#[test]
fn test_manifest_serde_roundtrip() {
    let manifest = creat_manifest();
    let json = serde_json::to_string(&manifest).expect("serialize manifest");
    let parsed: PluginManifest = serde_json::from_str(&json).expect("deserialize manifest");

    assert_eq!(parsed.id, "test-plugin");
    assert_eq!(parsed.version, "1.0.0");
    assert_eq!(parsed.api_version, CURRENT_API_VERSION);
    assert!(parsed.capabilities.exif_enhancement);
}

#[test]
fn test_capabilities_file_read() {
    let caps = PluginCapabilities {
        file_read: true,
        file_write: false,
        directory_create: false,
        exif_enhancement: false,
        grouping: false,
        merging: false,
        ui_extensions: false,
        custom_capabilities: vec![],
    };
    assert!(caps.has_file_read());
    assert!(!caps.has_file_write());
    assert!(!caps.has_directory_create());
}

#[test]
fn test_capabilities_file_write() {
    let caps = PluginCapabilities {
        file_read: false,
        file_write: true,
        directory_create: false,
        exif_enhancement: false,
        grouping: false,
        merging: false,
        ui_extensions: false,
        custom_capabilities: vec![],
    };
    assert!(!caps.has_file_read());
    assert!(caps.has_file_write());
    assert!(!caps.has_directory_create());
}

#[test]
fn test_capabilities_directory_create() {
    let caps = PluginCapabilities {
        file_read: false,
        file_write: false,
        directory_create: true,
        exif_enhancement: false,
        grouping: false,
        merging: false,
        ui_extensions: false,
        custom_capabilities: vec![],
    };
    assert!(!caps.has_file_read());
    assert!(!caps.has_file_write());
    assert!(caps.has_directory_create());
}

#[test]
fn test_config_schema_item_serialize() {
    let item = ConfigSchemaItem {
        item_type: "integer".to_string(),
        default: Some(serde_json::Value::Number(serde_json::Number::from(5))),
        description: Some("A test setting".to_string()),
        min: Some(1.0),
        max: Some(10.0),
        step: Some(1.0),
    };

    let json = serde_json::to_string(&item).expect("serialize config schema");
    let parsed: ConfigSchemaItem = serde_json::from_str(&json).expect("deserialize config schema");

    assert_eq!(parsed.item_type, "integer");
    assert_eq!(parsed.min, Some(1.0));
    assert_eq!(parsed.max, Some(10.0));
}

#[test]
fn test_manifest_empty_custom_capabilities() {
    let mut manifest = creat_manifest();
    manifest.capabilities.custom_capabilities = vec!["custom.export".to_string()];
    assert!(manifest.validate().is_ok());
    assert_eq!(manifest.capabilities.custom_capabilities.len(), 1);
}
