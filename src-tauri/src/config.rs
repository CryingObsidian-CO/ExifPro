use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::{env, fs};
use tauri_plugin_log::log;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub aeb_settings: AebSettings,
    pub focus_bracket_settings: FocusBracketSettings,
    pub burst_settings: BurstSettings,
    pub naming_rules: NamingRules,
    pub selection_config: SelectionConfig,
    pub preview_max_mb: u64,
    #[serde(default)]
    pub sub_second_digits: u8,
    #[serde(default)]
    pub plugin_settings: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub enabled_plugins: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionConfig {
    pub threshold_laplacian: f32,
    pub threshold_tenengrad: f32,
    pub threshold_brenner: f32,
    pub noise_bias_raw: f32,
    pub noise_bias_sdr_gamma: f32,
    pub noise_bias_hdr_linear: f32,
    pub max_parallel: u32,
    pub onnx_enabled: bool,
    pub threshold_onnx: f32,
    pub onnx_gpu: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AebSettings {
    pub max_span: f64,
    pub min_consecutive_interval: f64,
    pub max_consecutive_interval: f64,
    pub min_count: usize,
    pub auto_bracket_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusBracketSettings {
    pub enabled: bool,
    pub max_span: f64,
    pub min_consecutive_interval: f64,
    pub max_consecutive_interval: f64,
    pub min_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BurstSettings {
    pub min_consecutive_interval: f64,
    pub max_consecutive_interval: f64,
    pub min_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamingRules {
    pub focus_bracketing_prefix: String,
    pub aeb_prefix: String,
    pub burst_prefix: String,
    pub single_prefix: String,
}
impl Default for Config {
    fn default() -> Self {
        Config {
            aeb_settings: AebSettings::default(),
            focus_bracket_settings: FocusBracketSettings::default(),
            burst_settings: BurstSettings::default(),
            naming_rules: NamingRules::default(),
            selection_config: SelectionConfig::default(),
            preview_max_mb: 8,
            sub_second_digits: 3,
            plugin_settings: HashMap::new(),
            enabled_plugins: Vec::new(),
        }
    }
}

impl Default for AebSettings {
    fn default() -> Self {
        AebSettings {
            max_span: 1.0,
            min_consecutive_interval: 0.05,
            max_consecutive_interval: 0.3,
            min_count: 3,
            auto_bracket_only: false,
        }
    }
}

impl Default for FocusBracketSettings {
    fn default() -> Self {
        FocusBracketSettings {
            enabled: false,
            max_span: 1.0,
            min_consecutive_interval: 0.02,
            max_consecutive_interval: 0.5,
            min_count: 5,
        }
    }
}

impl Default for BurstSettings {
    fn default() -> Self {
        BurstSettings {
            min_consecutive_interval: 0.02,
            max_consecutive_interval: 0.5,
            min_count: 3,
        }
    }
}

impl Default for NamingRules {
    fn default() -> Self {
        NamingRules {
            focus_bracketing_prefix: "FocusBracket_".to_string(),
            aeb_prefix: "AEB_".to_string(),
            burst_prefix: "Burst_".to_string(),
            single_prefix: "".to_string(),
        }
    }
}

impl Default for SelectionConfig {
    fn default() -> Self {
        Self {
            threshold_laplacian: 0.40,
            threshold_tenengrad: 0.40,
            threshold_brenner: 0.45,
            noise_bias_raw: 0.02,
            noise_bias_sdr_gamma: 0.05,
            noise_bias_hdr_linear: 0.01,
            max_parallel: 0,
            onnx_enabled: true,
            threshold_onnx: 0.50,
            onnx_gpu: true,
        }
    }
}

impl Config {
    pub fn load() -> Result<Self, String> {
        let config_path = get_config_path()?;

        if config_path.exists() {
            log::debug!("config.load: start path={}", config_path.display());
            let config_content = fs::read_to_string(&config_path).map_err(|e| {
                log::error!(
                    "config.load: read_failed path={} err={}",
                    config_path.display(),
                    e
                );
                format!("Failed to read config file: {:?}", config_path)
            })?;
            let config: Self = serde_json::from_str(&config_content).map_err(|e| {
                log::error!(
                    "config.load: parse_failed path={} err={}",
                    config_path.display(),
                    e
                );
                format!("Failed to parse config file: {:?}", config_path)
            })?;
            log::info!("config.load: complete path={}", config_path.display());
            Ok(config)
        } else {
            log::warn!(
                "config.load: missing path={} default=true",
                config_path.display()
            );
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let config_path = get_config_path()?;
        log::debug!("config.save: start path={}", config_path.display());
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                log::error!(
                    "config.save: mkdir_failed path={} err={}",
                    parent.display(),
                    e
                );
                format!("Failed to create directory: {:?}", parent)
            })?;
        }

        let config_content = serde_json::to_string_pretty(self).map_err(|e| {
            log::error!("config.save: serialize_failed err={}", e);
            format!("Failed to serialize config: {:?}", e)
        })?;
        fs::write(&config_path, config_content).map_err(|e| {
            log::error!(
                "config.save: write_failed path={} err={}",
                config_path.display(),
                e
            );
            format!("Failed to write config file: {:?}", e)
        })?;
        log::info!("config.save: complete path={}", config_path.display());
        Ok(())
    }
}

fn get_config_path() -> Result<PathBuf, String> {
    let exe_path = env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe_path.parent().ok_or("Failed to get parent directory")?;

    let config_path = exe_dir.join("config.json");
    log::debug!("config.path: resolved path={}", config_path.display());
    Ok(config_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static CONFIG_MUTEX: Mutex<()> = Mutex::new(());

    fn clean_config() {
        if let Ok(p) = get_config_path() {
            let _ = std::fs::remove_file(&p);
        }
    }

    #[test]
    fn test_get_config_path_success() {
        let path = get_config_path();
        assert!(path.is_ok());
        let path = path.unwrap();
        assert!(path.ends_with("config.json"));
    }

    #[test]
    fn test_config_save_and_load_roundtrip() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let mut config = Config::default();
        config.preview_max_mb = 42;
        config.sub_second_digits = 5;
        config.naming_rules.aeb_prefix = "CustomAEB_".to_string();

        let save_result = config.save();
        assert!(save_result.is_ok());

        let loaded = Config::load();
        assert!(loaded.is_ok());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.preview_max_mb, 42);
        assert_eq!(loaded.sub_second_digits, 5);
        assert_eq!(loaded.naming_rules.aeb_prefix, "CustomAEB_");

        clean_config();
    }

    #[test]
    fn test_config_load_invalid_json() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let path = get_config_path().unwrap();
        std::fs::write(&path, "not valid json {").unwrap();

        let result = Config::load();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("parse"));

        clean_config();
    }

    #[test]
    fn test_config_load_from_saved_file() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let config = Config::default();
        config.save().unwrap();

        let loaded = Config::load();
        assert!(loaded.is_ok());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.preview_max_mb, config.preview_max_mb);
        assert_eq!(loaded.sub_second_digits, config.sub_second_digits);

        clean_config();
    }

    #[test]
    fn test_config_save_creates_parent_directory() {
        let _lock = CONFIG_MUTEX.lock().unwrap();
        clean_config();

        let config = Config::default();
        let result = config.save();
        assert!(result.is_ok());

        let cfg_path = get_config_path().unwrap();
        assert!(cfg_path.exists());

        clean_config();
    }
}
