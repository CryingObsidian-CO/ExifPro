export interface AebSettings {
  max_span: number;
  min_consecutive_interval: number;
  max_consecutive_interval: number;
  min_count: number;
  auto_bracket_only: boolean;
}

export interface FocusBracketSettings {
  enabled: boolean;
  max_span: number;
  min_consecutive_interval: number;
  max_consecutive_interval: number;
  min_count: number;
}

export interface BurstSettings {
  min_consecutive_interval: number;
  max_consecutive_interval: number;
  min_count: number;
}

export interface NamingRules {
  focus_bracketing_prefix: string;
  aeb_prefix: string;
  burst_prefix: string;
  single_prefix: string;
}

export interface Config {
  aeb_settings: AebSettings;
  focus_bracket_settings: FocusBracketSettings;
  burst_settings: BurstSettings;
  naming_rules: NamingRules;
  preview_max_mb: number;
  sub_second_digits: number;
  plugin_settings: Record<string, Record<string, any>>;
  enabled_plugins: string[];
}