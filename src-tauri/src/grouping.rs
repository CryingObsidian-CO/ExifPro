use crate::config::Config;
use crate::exif::ExifInfo;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fmt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum GroupType {
    FocusBracketing,
    AEB,
    Burst,
    Single,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Group {
    pub id: String,
    pub group_type: GroupType,
    pub name: String,
    pub photos: Vec<ExifInfo>,
}

impl fmt::Display for GroupType {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            GroupType::FocusBracketing => write!(f, "FocusBracketing"),
            GroupType::AEB => write!(f, "AEB"),
            GroupType::Burst => write!(f, "Burst"),
            GroupType::Single => write!(f, "Single"),
        }
    }
}

#[inline]
pub fn cmp_time(a: &ExifInfo, b: &ExifInfo) -> Ordering {
    parse_capture_time(a)
        .partial_cmp(&parse_capture_time(b))
        .unwrap_or(Ordering::Equal)
}

pub fn group_photos(mut photos: Vec<ExifInfo>, config: &Config) -> Vec<Group> {
    photos.sort_by(|a, b| cmp_time(a, b));
    let mut groups = Vec::new();
    let mut used = vec![false; photos.len()];
    let mut group_id_counter = 0;

    let mut ungrouped_photos = Vec::new();

    for i in 0..photos.len() {
        if used[i] {
            continue;
        }

        let mut found_group = false;
        for j in (config.focus_bracket_settings.min_count..=photos.len() - i).rev() {
            let photo_group = &photos[i..i + j];
            if is_focus_bracketing(photo_group, config) {
                let group = Group {
                    id: format!("group_{}", group_id_counter),
                    group_type: GroupType::FocusBracketing,
                    name: generate_group_name(&GroupType::FocusBracketing, photo_group, config),
                    photos: photo_group.to_vec(),
                };
                groups.push(group);
                for k in i..i + j {
                    used[k] = true;
                }
                group_id_counter += 1;
                found_group = true;
                break;
            }
        }

        if found_group {
            continue;
        }

        for j in (config.aeb_settings.min_count..=photos.len() - i).rev() {
            let aeb_group = &photos[i..i + j];
            if is_aeb(aeb_group, config) {
                let group = Group {
                    id: format!("group_{}", group_id_counter),
                    group_type: GroupType::AEB,
                    name: generate_group_name(&GroupType::AEB, aeb_group, config),
                    photos: aeb_group.to_vec(),
                };
                groups.push(group);
                for k in i..i + j {
                    used[k] = true;
                }
                group_id_counter += 1;
                found_group = true;
                break;
            }
        }

        if found_group {
            continue;
        }

        for j in (config.burst_settings.min_count..=photos.len() - i).rev() {
            let burst_group = &photos[i..i + j];
            if is_burst(burst_group, config) {
                let group = Group {
                    id: format!("group_{}", group_id_counter),
                    group_type: GroupType::Burst,
                    name: generate_group_name(&GroupType::Burst, burst_group, config),
                    photos: burst_group.to_vec(),
                };
                groups.push(group);
                for k in i..i + j {
                    used[k] = true;
                }
                group_id_counter += 1;
                found_group = true;
                break;
            }
        }

        if found_group {
            continue;
        }

        ungrouped_photos.push(photos[i].clone());
        used[i] = true;
    }

    let ungrouped_group = Group {
        id: "ungrouped".to_string(),
        group_type: GroupType::Single,
        name: "未分组".to_string(),
        photos: ungrouped_photos,
    };
    groups.push(ungrouped_group);

    groups
}

fn generate_group_name(group_type: &GroupType, groups: &[ExifInfo], config: &Config) -> String {
    let prefix = match group_type {
        GroupType::FocusBracketing => &config.naming_rules.focus_bracketing_prefix,
        GroupType::AEB => &config.naming_rules.aeb_prefix,
        GroupType::Burst => &config.naming_rules.burst_prefix,
        GroupType::Single => &config.naming_rules.single_prefix,
    };
    let base_name = groups
        .first()
        .and_then(|p| p.file_name.split('.').next())
        .unwrap_or("group");
    format!("{}{}", prefix, base_name)
}

fn parse_focus_distance(focus_distance: &str) -> Option<f64> {
    let cleaned = focus_distance
        .replace("m", "")
        .replace("in", "")
        .trim()
        .to_string();
    cleaned.parse::<f64>().ok()
}

fn parse_capture_time(time_info: &ExifInfo) -> Option<DateTime<Utc>> {
    let capture = time_info.capture_time.as_deref().unwrap_or("");
    let sub = time_info.sub_time.as_deref().unwrap_or("999");
    let time_str = format!("{}.{}", capture, sub);

    if let Ok(dt) = DateTime::parse_from_str(time_str.as_str(), "%Y:%m:%d %H:%M:%S.%f") {
        Some(dt.with_timezone(&Utc))
    } else if let Ok(dt) = DateTime::parse_from_str(time_str.as_str(), "%Y-%m-%d %H:%M:%S.%f") {
        Some(dt.with_timezone(&Utc))
    } else {
        None
    }
}

fn parse_exposure_value(ev_str: &str) -> Option<f64> {
    let cleaned = ev_str.replace("EV", "").trim().to_string();
    cleaned.parse::<f64>().ok()
}

fn time_diff_seconds(a: &ExifInfo, b: &ExifInfo) -> Option<f64> {
    let dt_a = parse_capture_time(a)?;
    let dt_b = parse_capture_time(b)?;
    let diff = dt_a.signed_duration_since(dt_b);
    Some(diff.num_milliseconds() as f64 / 1000.0)
}

fn is_monotonic(vec: &[Option<f64>]) -> bool {
    if vec.len() < 2 {
        return true;
    }

    let non_none: Vec<f64> = vec.iter().filter_map(|&x| x).collect();
    if non_none.len() < 2 {
        return true;
    }

    let increasing = non_none.windows(2).all(|w| w[0] <= w[1]);
    let decreasing = non_none.windows(2).all(|w| w[0] >= w[1]);
    increasing || decreasing
}

fn is_focus_bracketing(groups: &[ExifInfo], config: &Config) -> bool {
    if groups.len() < config.focus_bracket_settings.min_count {
        return false;
    }
    let first = groups.first().unwrap();
    let last = groups.last().unwrap();
    if let Some(time_span) = time_diff_seconds(last, first) {
        if time_span > config.focus_bracket_settings.max_span {
            return false;
        }
    }

    for w in groups.windows(2) {
        if let Some(interval) = time_diff_seconds(&w[0], &w[1]) {
            if interval < config.focus_bracket_settings.min_consecutive_interval
                || interval > config.focus_bracket_settings.max_consecutive_interval
            {
                return false;
            }
        }
    }

    let same_shutter = groups
        .windows(2)
        .all(|w| w[0].shutter_speed == w[1].shutter_speed);
    let same_aperture = groups.windows(2).all(|w| w[0].aperture == w[1].aperture);
    let same_iso = groups.windows(2).all(|w| w[0].iso == w[1].iso);
    let same_ev = groups
        .windows(2)
        .all(|w| w[0].exposure_compensation == w[1].exposure_compensation);
    let same_focal = groups
        .windows(2)
        .all(|w| w[0].focal_length == w[1].focal_length);

    if !same_shutter || !same_aperture || !same_iso || !same_ev || !same_focal {
        return false;
    }

    let focus_distances: Vec<Option<f64>> = groups
        .iter()
        .map(|p| {
            p.focus_distance
                .as_ref()
                .and_then(|s| parse_focus_distance(s))
        })
        .collect();

    is_monotonic(&focus_distances)
}

fn is_aeb(groups: &[ExifInfo], config: &Config) -> bool {
    if groups.len() < config.aeb_settings.min_count {
        return false;
    }

    let first = groups.first().unwrap();
    let last = groups.last().unwrap();

    if let Some(time_span) = time_diff_seconds(last, first) {
        if time_span > config.aeb_settings.max_span {
            return false;
        }
    }

    for w in groups.windows(2) {
        if let Some(interval) = time_diff_seconds(&w[0], &w[1]) {
            if interval < config.aeb_settings.min_consecutive_interval
                || interval > config.aeb_settings.max_consecutive_interval
            {
                return false;
            }
        }
    }

    let same_focal = groups
        .windows(2)
        .all(|w| w[0].focal_length == w[1].focal_length);
    if !same_focal {
        return false;
    }

    let ev_values: Vec<Option<f64>> = groups
        .iter()
        .map(|p| {
            p.exposure_compensation
                .as_ref()
                .and_then(|s| parse_exposure_value(s))
        })
        .collect();

    let has_zero = ev_values.iter().any(|&ev| ev == Some(0.0));
    let has_positive = ev_values
        .iter()
        .any(|&ev| ev.map(|e| e > 0.0).unwrap_or(false));
    let has_negative = ev_values
        .iter()
        .any(|&ev| ev.map(|e| e < 0.0).unwrap_or(false));

    // TODO 优化相应逻辑，从是否有的判断改为是否对称变化
    if !has_zero || !has_positive || !has_negative {
        return false;
    }

    let param_different = groups.windows(2).any(|w| {
        w[0].shutter_speed != w[1].shutter_speed
            || w[0].aperture != w[1].aperture
            || w[0].iso != w[1].iso
    });

    param_different
}

fn is_burst(groups: &[ExifInfo], config: &Config) -> bool {
    if groups.len() < config.burst_settings.min_count {
        return false;
    }

    for w in groups.windows(2) {
        if let Some(interval) = time_diff_seconds(&w[0], &w[1]) {
            if interval < config.burst_settings.min_consecutive_interval
                || interval > config.burst_settings.max_consecutive_interval
            {
                return false;
            }
        }
    }

    let same_params = groups.windows(2).all(|w| {
        w[0].shutter_speed == w[1].shutter_speed
            && w[0].aperture == w[1].aperture
            && w[0].iso == w[1].iso
            && w[0].exposure_compensation == w[1].exposure_compensation
            && w[0].focal_length == w[1].focal_length
            && w[0].focus_distance == w[1].focus_distance
    });
    same_params
}
