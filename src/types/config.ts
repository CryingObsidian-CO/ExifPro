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
  selection_config: SelectionConfig;
  preview_max_mb: number;
  sub_second_digits: number;
  plugin_settings: Record<string, Record<string, any>>;
  enabled_plugins: string[];
}

export interface SelectionConfig {
  threshold_laplacian: number;
  threshold_tenengrad: number;
  threshold_brenner: number;
  noise_bias_raw: number;
  noise_bias_sdr_gamma: number;
  noise_bias_hdr_linear: number;
  max_parallel: number;
  onnx_enabled: boolean;
  threshold_onnx: number;
  onnx_gpu: boolean;
}