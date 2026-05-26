use exifpro_lib::config::Config;

fn config_values_is_default(config: Config) {
    assert_eq!(config.aeb_settings.max_span, 1.0);
    assert_eq!(config.aeb_settings.min_consecutive_interval, 0.05);
    assert_eq!(config.aeb_settings.max_consecutive_interval, 0.3);
    assert_eq!(config.aeb_settings.min_count, 3);
    assert!(!config.aeb_settings.auto_bracket_only);

    assert!(!config.focus_bracket_settings.enabled);
    assert_eq!(config.focus_bracket_settings.max_span, 1.0);
    assert_eq!(config.focus_bracket_settings.min_consecutive_interval, 0.02);
    assert_eq!(config.focus_bracket_settings.max_consecutive_interval, 0.5);
    assert_eq!(config.focus_bracket_settings.min_count, 5);

    assert_eq!(config.burst_settings.min_consecutive_interval, 0.02);
    assert_eq!(config.burst_settings.max_consecutive_interval, 0.5);
    assert_eq!(config.burst_settings.min_count, 3);

    assert!(!config.naming_rules.focus_bracketing_prefix.is_empty());
    assert!(!config.naming_rules.aeb_prefix.is_empty());
    assert!(!config.naming_rules.burst_prefix.is_empty());
    assert!(config.naming_rules.single_prefix.is_empty());

    assert_eq!(config.preview_max_mb, 8);
    assert_eq!(config.sub_second_digits, 3);

    assert!(config.plugin_settings.is_empty());
    assert!(config.enabled_plugins.is_empty());
}

#[test]
fn test_config_default_values() {
    let config = Config::default();
    config_values_is_default(config);
}

#[test]
fn test_config_load_missing_file_returns_default() {
    let cfg = Config::load().unwrap();
    config_values_is_default(cfg);
}

#[test]
fn test_config_serialize_deserialize() {
    let config = Config::default();
    let json = serde_json::to_string(&config).expect("serialize should succeed");
    let parsed: Config = serde_json::from_str(&json).expect("deserialize should succeed");

    config_values_is_default(parsed);
}
