use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::{env, fs};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub aeb_settings: AebSettings,
    pub focus_bracket_settings: FocusBracketSettings,
    pub burst_settings: BurstSettings,
    pub naming_rules: NamingRules,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AebSettings {
    pub max_span: f64,
    pub min_consecutive_interval: f64,
    pub max_consecutive_interval: f64,
    pub min_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusBracketSettings {
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
        }
    }
}

impl Default for AebSettings {
    fn default() -> Self {
        AebSettings {
            max_span: 0.3,
            min_consecutive_interval: 0.05,
            max_consecutive_interval: 0.3,
            min_count: 3,
        }
    }
}

impl Default for FocusBracketSettings {
    fn default() -> Self {
        FocusBracketSettings {
            max_span: 0.5,
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

impl Config {
    pub fn load() -> Result<Self, String> {
        let config_path = get_config_path()?;

        if config_path.exists() {
            let config_content = fs::read_to_string(&config_path)
                .map_err(|_| format!("Failed to read config file: {:?}", config_path))?;
            let config: Self = serde_json::from_str(&config_content)
                .map_err(|_| format!("Failed to parse config file: {:?}", config_path))?;

            Ok(config)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let config_path = get_config_path()?;
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|_| format!("Failed to create directory: {:?}", parent))?;
        }

        let config_content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {:?}", e))?;
        fs::write(config_path, config_content)
            .map_err(|e| format!("Failed to write config file: {:?}", e))?;
        Ok(())
    }
}

fn get_config_path() -> Result<PathBuf, String> {
    let exe_path = env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe_path.parent().ok_or("Failed to get parent directory")?;

    let config_path = exe_dir.join("config.json");
    Ok(config_path)
}
