use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::{env, fs};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub time_thresholds: TimeThresholds,
    pub group_parameters: GroupParameters,
    pub naming_rules: NamingRules,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeThresholds {
    pub burst_max_interval: f64,
    pub aeb_max_span: f64,
    pub focus_bracket_max_span: f64,
    pub min_group_interval: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupParameters {
    pub burst_min_count: usize,
    pub aeb_min_count: usize,
    pub focus_bracket_min_count: usize,
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
            time_thresholds: TimeThresholds::default(),
            group_parameters: GroupParameters::default(),
            naming_rules: NamingRules::default(),
        }
    }
}

impl Default for TimeThresholds {
    fn default() -> Self {
        TimeThresholds {
            burst_max_interval: 0.5,
            aeb_max_span: 0.3,
            focus_bracket_max_span: 0.5,
            min_group_interval: 2.0,
        }
    }
}

impl Default for GroupParameters {
    fn default() -> Self {
        GroupParameters {
            burst_min_count: 3,
            aeb_min_count: 3,
            focus_bracket_min_count: 5,
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
    // let config_dir = exe_dir.join(".config");
    // fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    let config_path = exe_dir.join("config.json");
    Ok(config_path)
}
