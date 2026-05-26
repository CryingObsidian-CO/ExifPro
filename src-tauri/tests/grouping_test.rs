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
