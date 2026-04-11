export interface TimeThresholds {
  burst_max_interval: number;
  aeb_max_span: number;
  focus_bracket_max_span: number;
  min_group_interval: number;
}

export interface GroupParameters {
  burst_min_count: number;
  aeb_min_count: number;
  focus_bracket_min_count: number;
}

export interface NamingRules {
  focus_bracketing_prefix: string;
  aeb_prefix: string;
  burst_prefix: string;
  single_prefix: string;
}

export interface Config {
  time_thresholds: TimeThresholds;
  group_parameters: GroupParameters;
  naming_rules: NamingRules;
}