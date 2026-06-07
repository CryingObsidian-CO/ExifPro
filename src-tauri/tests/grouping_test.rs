use exifpro_lib::config::Config;
use exifpro_lib::exif::ExifInfo;
use exifpro_lib::grouping::{cmp_time, group_photos, GroupType};

fn basic_photo(path: &str, name: &str, capture: &str, sub: &str) -> ExifInfo {
    ExifInfo {
        file_path: path.to_string(),
        file_name: name.to_string(),
        capture_time: Some(capture.to_string()),
        sub_time: Some(sub.to_string()),
        offset_time_original: Some("+08:00".to_string()),
        shutter_speed: Some("1/500".to_string()),
        aperture: Some("f/5.6".to_string()),
        iso: Some("200".to_string()),
        exposure_compensation: Some("0.0".to_string()),
        exposure_mode: Some(2),
        focal_length: Some("50mm".to_string()),
        focus_distance: Some("3.0".to_string()),
        camera_make: Some("SONY".to_string()),
        camera_model: Some("ILCE-7CM2".to_string()),
    }
}

fn burst_photos() -> Vec<ExifInfo> {
    vec![
        basic_photo(
            "/a/burst_01.jpg",
            "burst_01.jpg",
            "2024:01:15 10:30:00",
            "050000",
        ),
        basic_photo(
            "/a/burst_02.jpg",
            "burst_02.jpg",
            "2024:01:15 10:30:00",
            "100000",
        ),
        basic_photo(
            "/a/burst_03.jpg",
            "burst_03.jpg",
            "2024:01:15 10:30:00",
            "150000",
        ),
        basic_photo(
            "/a/burst_04.jpg",
            "burst_04.jpg",
            "2024:01:15 10:30:00",
            "200000",
        ),
    ]
}

#[tokio::test]
async fn test_group_photos_empty() {
    let photos: Vec<ExifInfo> = vec![];
    let config = Config::default();
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    assert!(!groups.is_empty());
}

#[tokio::test]
async fn test_group_photos_single_photo() {
    let photos = vec![basic_photo(
        "/a/one.jpg",
        "one.jpg",
        "2024:01:15 10:30:00",
        "000000",
    )];
    let config = Config::default();
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    assert!(!groups.is_empty());
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].photos.len(), 1);
}

#[tokio::test]
async fn test_group_photos_single_group_type_burst() {
    let photos = burst_photos();
    let mut config = Config::default();
    config.burst_settings.max_consecutive_interval = 1.0;
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    assert!(!groups.is_empty());
    assert_eq!(groups.len(), 2);
    assert_eq!(groups[0].photos.len(), 4);
}

#[tokio::test]
async fn test_group_photos_config_influence() {
    let photos = burst_photos();
    let mut strict_config = Config::default();
    strict_config.burst_settings.min_count = 10;
    strict_config.burst_settings.max_consecutive_interval = 0.001;
    let result = group_photos(photos.clone(), strict_config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    assert!(!groups.is_empty());
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].group_type, GroupType::Single);
}

#[test]
fn test_group_type_display() {
    assert_eq!(format!("{}", GroupType::FocusBracketing), "FocusBracketing");
    assert_eq!(format!("{}", GroupType::AEB), "AEB");
    assert_eq!(format!("{}", GroupType::Burst), "Burst");
    assert_eq!(format!("{}", GroupType::Single), "Single");
    assert_eq!(
        format!("{}", GroupType::Custom("MyGroup".to_string())),
        "MyGroup"
    );
}

#[test]
fn test_group_type_serde() {
    let gt = GroupType::AEB;
    let json = serde_json::to_string(&gt).expect("serialize GroupType");
    let parsed: GroupType = serde_json::from_str(&json).expect("deserialize GroupType");
    assert_eq!(parsed, GroupType::AEB);
}

#[test]
fn test_cmp_time_ordering() {
    let a = basic_photo("/a/early.jpg", "early.jpg", "2024:01:15 10:30:00", "000000");
    let b = basic_photo("/a/late.jpg", "late.jpg", "2024:01:15 10:30:01", "000000");

    assert_eq!(cmp_time(&a, &b), std::cmp::Ordering::Less);
    assert_eq!(cmp_time(&b, &a), std::cmp::Ordering::Greater);
    assert_eq!(cmp_time(&a, &a), std::cmp::Ordering::Equal);
}

#[test]
fn test_cmp_time_same_capture_diff_sub_time() {
    let a = basic_photo("/a/early.jpg", "early.jpg", "2024:01:15 10:30:00", "100000");
    let b = basic_photo("/a/late.jpg", "late.jpg", "2024:01:15 10:30:00", "200000");

    assert_eq!(cmp_time(&a, &b), std::cmp::Ordering::Less);
}

fn aeb_photo(
    path: &str,
    name: &str,
    capture: &str,
    sub: &str,
    shutter: &str,
    aperture: &str,
    iso: &str,
    ev: &str,
    exposure_mode: Option<u32>,
) -> ExifInfo {
    ExifInfo {
        file_path: path.to_string(),
        file_name: name.to_string(),
        capture_time: Some(capture.to_string()),
        sub_time: Some(sub.to_string()),
        offset_time_original: Some("+08:00".to_string()),
        shutter_speed: Some(shutter.to_string()),
        aperture: Some(aperture.to_string()),
        iso: Some(iso.to_string()),
        exposure_compensation: Some(ev.to_string()),
        exposure_mode,
        focal_length: Some("50mm".to_string()),
        focus_distance: None,
        camera_make: Some("SONY".to_string()),
        camera_model: Some("ILCE-7CM2".to_string()),
    }
}

#[tokio::test]
async fn test_group_photos_aeb_symmetric_ev() {
    let photos = vec![
        aeb_photo(
            "/a/aeb_01.jpg",
            "aeb_01.jpg",
            "2024:01:15 10:30:00",
            "000000",
            "1/250",
            "f/8",
            "400",
            "-2.0",
            Some(1),
        ),
        aeb_photo(
            "/a/aeb_02.jpg",
            "aeb_02.jpg",
            "2024:01:15 10:30:00",
            "100000",
            "1/125",
            "f/8",
            "200",
            "0.0",
            Some(1),
        ),
        aeb_photo(
            "/a/aeb_03.jpg",
            "aeb_03.jpg",
            "2024:01:15 10:30:00",
            "200000",
            "1/60",
            "f/8",
            "100",
            "+2.0",
            Some(1),
        ),
    ];
    let config = Config::default();
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    let aeb_groups: Vec<_> = groups
        .iter()
        .filter(|g| g.group_type == GroupType::AEB)
        .collect();
    assert_eq!(aeb_groups.len(), 1);
    assert_eq!(aeb_groups[0].photos.len(), 3);
}

#[tokio::test]
async fn test_group_photos_aeb_auto_bracket_only() {
    let photos = vec![
        aeb_photo(
            "/a/aeb_01.jpg",
            "aeb_01.jpg",
            "2024:01:15 10:30:00",
            "000000",
            "1/250",
            "f/8",
            "400",
            "-2.0",
            Some(2),
        ),
        aeb_photo(
            "/a/aeb_02.jpg",
            "aeb_02.jpg",
            "2024:01:15 10:30:00",
            "100000",
            "1/125",
            "f/8",
            "200",
            "0.0",
            Some(2),
        ),
        aeb_photo(
            "/a/aeb_03.jpg",
            "aeb_03.jpg",
            "2024:01:15 10:30:00",
            "200000",
            "1/60",
            "f/8",
            "100",
            "+2.0",
            Some(2),
        ),
    ];
    let mut config = Config::default();
    config.aeb_settings.auto_bracket_only = true;
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    let aeb_groups: Vec<_> = groups
        .iter()
        .filter(|g| g.group_type == GroupType::AEB)
        .collect();
    assert_eq!(
        aeb_groups.len(),
        1,
        "exposure_mode=2 should be recognized as AEB when auto_bracket_only is set"
    );
}

#[tokio::test]
async fn test_group_photos_aeb_non_auto_bracket_rejected() {
    let photos = vec![
        aeb_photo(
            "/a/aeb_01.jpg",
            "aeb_01.jpg",
            "2024:01:15 10:30:00",
            "000000",
            "1/250",
            "f/8",
            "400",
            "-2.0",
            Some(1),
        ),
        aeb_photo(
            "/a/aeb_02.jpg",
            "aeb_02.jpg",
            "2024:01:15 10:30:00",
            "100000",
            "1/125",
            "f/8",
            "200",
            "0.0",
            Some(1),
        ),
        aeb_photo(
            "/a/aeb_03.jpg",
            "aeb_03.jpg",
            "2024:01:15 10:30:00",
            "200000",
            "1/60",
            "f/8",
            "100",
            "+2.0",
            Some(1),
        ),
    ];
    let mut config = Config::default();
    config.aeb_settings.auto_bracket_only = true;
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    let aeb_groups: Vec<_> = groups
        .iter()
        .filter(|g| g.group_type == GroupType::AEB)
        .collect();
    assert_eq!(
        aeb_groups.len(),
        0,
        "non-auto-bracket exposures should not be grouped into AEB when auto_bracket_only is set"
    );
}

fn fb_photo(
    path: &str,
    name: &str,
    capture: &str,
    sub: &str,
    focus_distance: Option<&str>,
) -> ExifInfo {
    ExifInfo {
        file_path: path.to_string(),
        file_name: name.to_string(),
        capture_time: Some(capture.to_string()),
        sub_time: Some(sub.to_string()),
        offset_time_original: Some("+08:00".to_string()),
        shutter_speed: Some("1/125".to_string()),
        aperture: Some("f/8".to_string()),
        iso: Some("400".to_string()),
        exposure_compensation: Some("0.0".to_string()),
        exposure_mode: Some(0),
        focal_length: Some("50mm".to_string()),
        focus_distance: focus_distance.map(|s| s.to_string()),
        camera_make: Some("SONY".to_string()),
        camera_model: Some("ILCE-7CM2".to_string()),
    }
}

#[tokio::test]
async fn test_group_photos_focus_bracketing_enabled() {
    let photos = vec![
        fb_photo(
            "/a/fb_01.jpg",
            "fb_01.jpg",
            "2024:01:15 10:30:00",
            "000000",
            Some("1.0"),
        ),
        fb_photo(
            "/a/fb_02.jpg",
            "fb_02.jpg",
            "2024:01:15 10:30:00",
            "100000",
            Some("1.5"),
        ),
        fb_photo(
            "/a/fb_03.jpg",
            "fb_03.jpg",
            "2024:01:15 10:30:00",
            "200000",
            Some("2.0"),
        ),
        fb_photo(
            "/a/fb_04.jpg",
            "fb_04.jpg",
            "2024:01:15 10:30:00",
            "300000",
            Some("2.5"),
        ),
        fb_photo(
            "/a/fb_05.jpg",
            "fb_05.jpg",
            "2024:01:15 10:30:00",
            "400000",
            Some("3.0"),
        ),
    ];
    let mut config = Config::default();
    config.focus_bracket_settings.enabled = true;
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    let fb_groups: Vec<_> = groups
        .iter()
        .filter(|g| g.group_type == GroupType::FocusBracketing)
        .collect();
    assert_eq!(
        fb_groups.len(),
        1,
        "5 photos should be grouped into focus bracketing when enabled"
    );
}

#[tokio::test]
async fn test_group_photos_focus_bracketing_disabled() {
    let photos = vec![
        fb_photo(
            "/a/fb_01.jpg",
            "fb_01.jpg",
            "2024:01:15 10:30:00",
            "000000",
            Some("1.0"),
        ),
        fb_photo(
            "/a/fb_02.jpg",
            "fb_02.jpg",
            "2024:01:15 10:30:00",
            "100000",
            Some("1.5"),
        ),
        fb_photo(
            "/a/fb_03.jpg",
            "fb_03.jpg",
            "2024:01:15 10:30:00",
            "200000",
            Some("2.0"),
        ),
        fb_photo(
            "/a/fb_04.jpg",
            "fb_04.jpg",
            "2024:01:15 10:30:00",
            "300000",
            Some("2.5"),
        ),
        fb_photo(
            "/a/fb_05.jpg",
            "fb_05.jpg",
            "2024:01:15 10:30:00",
            "400000",
            Some("3.0"),
        ),
    ];
    let config = Config::default();
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    let fb_groups: Vec<_> = groups
        .iter()
        .filter(|g| g.group_type == GroupType::FocusBracketing)
        .collect();
    assert_eq!(
        fb_groups.len(),
        0,
        "focus bracketing should not group when disabled by default"
    );
}

#[tokio::test]
async fn test_group_photos_focus_bracketing_not_monotonic() {
    let photos = vec![
        fb_photo(
            "/a/fb_01.jpg",
            "fb_01.jpg",
            "2024:01:15 10:30:00",
            "000000",
            Some("1.0"),
        ),
        fb_photo(
            "/a/fb_02.jpg",
            "fb_02.jpg",
            "2024:01:15 10:30:00",
            "100000",
            Some("3.0"),
        ),
        fb_photo(
            "/a/fb_03.jpg",
            "fb_03.jpg",
            "2024:01:15 10:30:00",
            "200000",
            Some("2.0"),
        ),
        fb_photo(
            "/a/fb_04.jpg",
            "fb_04.jpg",
            "2024:01:15 10:30:00",
            "300000",
            Some("2.5"),
        ),
        fb_photo(
            "/a/fb_05.jpg",
            "fb_05.jpg",
            "2024:01:15 10:30:00",
            "400000",
            Some("3.0"),
        ),
    ];
    let mut config = Config::default();
    config.focus_bracket_settings.enabled = true;
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    let fb_groups: Vec<_> = groups
        .iter()
        .filter(|g| g.group_type == GroupType::FocusBracketing)
        .collect();
    assert_eq!(
        fb_groups.len(),
        0,
        "non-monotonic focus distances should not be grouped into focus bracketing"
    );
}

#[tokio::test]
async fn test_group_photos_burst_and_single_mixed() {
    // 3 张符合连拍条件 + 1 张单独照片
    let burst_photos = vec![
        basic_photo("/a/b01.jpg", "b01.jpg", "2024:01:15 10:30:00", "000000"),
        basic_photo("/a/b02.jpg", "b02.jpg", "2024:01:15 10:30:00", "050000"),
        basic_photo("/a/b03.jpg", "b03.jpg", "2024:01:15 10:30:00", "100000"),
    ];
    let single = basic_photo(
        "/a/single.jpg",
        "single.jpg",
        "2024:01:15 11:00:00",
        "000000",
    );

    let mut photos = burst_photos;
    photos.push(single);
    let config = Config::default();
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    let burst_groups: Vec<_> = groups
        .iter()
        .filter(|g| g.group_type == GroupType::Burst)
        .collect();
    assert_eq!(burst_groups.len(), 1, "should identify burst group");
    let ungrouped = groups.iter().find(|g| g.id == "ungrouped").unwrap();
    assert_eq!(
        ungrouped.photos.len(),
        1,
        "single photo should go to ungrouped"
    );
}

#[tokio::test]
async fn test_group_photos_time_span_rejects() {
    let photos = vec![
        basic_photo(
            "/a/far_01.jpg",
            "far_01.jpg",
            "2024:01:15 10:30:00",
            "000000",
        ),
        basic_photo(
            "/a/far_02.jpg",
            "far_02.jpg",
            "2024:01:15 10:30:05",
            "000000",
        ),
        basic_photo(
            "/a/far_03.jpg",
            "far_03.jpg",
            "2024:01:15 10:31:00",
            "000000",
        ),
    ];
    let mut config = Config::default();
    config.burst_settings.max_consecutive_interval = 0.1;
    config.burst_settings.min_count = 2;
    let result = group_photos(photos, config).await;
    assert!(result.is_ok());
    let groups = result.unwrap();
    let burst_groups: Vec<_> = groups
        .iter()
        .filter(|g| g.group_type == GroupType::Burst)
        .collect();
    assert_eq!(
        burst_groups.len(),
        0,
        "large time span should not match burst"
    );
}
