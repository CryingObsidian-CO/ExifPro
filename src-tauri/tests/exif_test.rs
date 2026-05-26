use exifpro_lib::exif::ExifInfo;
use std::path::Path;

// NOTE 未测试 parse_exif() 函数

fn create_exif_info(
    file_path: &str,
    file_name: &str,
    capture_time: Option<&str>,
    sub_time: Option<&str>,
    shutter_speed: Option<&str>,
    aperture: Option<&str>,
    iso: Option<&str>,
    exposure_compensation: Option<&str>,
    exposure_mode: Option<u32>,
    focal_length: Option<&str>,
    focus_distance: Option<&str>,
    camera_make: Option<&str>,
    camera_model: Option<&str>,
) -> ExifInfo {
    ExifInfo {
        file_path: file_path.to_string(),
        file_name: file_name.to_string(),
        capture_time: capture_time.map(|s| s.to_string()),
        sub_time: sub_time.map(|s| s.to_string()),
        offset_time_original: None,
        shutter_speed: shutter_speed.map(|s| s.to_string()),
        aperture: aperture.map(|s| s.to_string()),
        iso: iso.map(|s| s.to_string()),
        exposure_compensation: exposure_compensation.map(|s| s.to_string()),
        exposure_mode,
        focal_length: focal_length.map(|s| s.to_string()),
        focus_distance: focus_distance.map(|s| s.to_string()),
        camera_make: camera_make.map(|s| s.to_string()),
        camera_model: camera_model.map(|s| s.to_string()),
    }
}

#[test]
fn test_exif_info_new_unicode_filename() {
    let path = Path::new("/test/照片.jpg");
    let info = ExifInfo::new(path);

    assert_eq!(info.file_name, "照片.jpg");
}

#[test]
fn test_exif_info_all_fields_optional() {
    let info = create_exif_info(
        "/test/img.jpg",
        "img.jpg",
        Some("2024:01:15 10:30:00"),
        Some("123456"),
        Some("1/125"),
        Some("f/8.0"),
        Some("400"),
        Some("0.0"),
        Some(0),
        Some("50mm"),
        Some("5.0"),
        Some("SONY"),
        Some("ILCE-7CM2"),
    );

    assert_eq!(info.file_path, "/test/img.jpg");
    assert_eq!(info.file_name, "img.jpg");
    assert_eq!(info.capture_time.as_deref(), Some("2024:01:15 10:30:00"));
    assert_eq!(info.sub_time.as_deref(), Some("123456"));
    assert_eq!(info.shutter_speed.as_deref(), Some("1/125"));
    assert_eq!(info.aperture.as_deref(), Some("f/8.0"));
    assert_eq!(info.iso.as_deref(), Some("400"));
    assert_eq!(info.exposure_compensation.as_deref(), Some("0.0"));
    assert_eq!(info.exposure_mode, Some(0));
    assert_eq!(info.focal_length.as_deref(), Some("50mm"));
    assert_eq!(info.focus_distance.as_deref(), Some("5.0"));
    assert_eq!(info.camera_make.as_deref(), Some("SONY"));
    assert_eq!(info.camera_model.as_deref(), Some("ILCE-7CM2"));
}

#[test]
fn test_exif_info_serde_roundtrip() {
    let info = create_exif_info(
        "/test/img.jpg",
        "img.jpg",
        Some("2024:01:15 10:30:00"),
        None,
        Some("1/125"),
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
    );

    let json = serde_json::to_string(&info).expect("serialize should succeed");
    let parsed: ExifInfo = serde_json::from_str(&json).expect("deserialize should succeed");

    assert_eq!(parsed.file_path, info.file_path);
    assert_eq!(parsed.file_name, info.file_name);
    assert_eq!(parsed.capture_time, info.capture_time);
    assert_eq!(parsed.shutter_speed, info.shutter_speed);
    assert!(parsed.sub_time.is_none());
    assert!(parsed.aperture.is_none());
    assert!(parsed.iso.is_none());
    assert!(parsed.exposure_compensation.is_none());
    assert!(parsed.exposure_mode.is_none());
    assert!(parsed.focal_length.is_none());
    assert!(parsed.focus_distance.is_none());
    assert!(parsed.camera_make.is_none());
    assert!(parsed.camera_model.is_none());
}

#[test]
fn test_get_thumbnail_data_invalid_level() {
    use exifpro_lib::exif::get_thumbnail_data;
    use std::path::Path;

    // 测试非法 level
    let thumb = get_thumbnail_data(Path::new("fake.jpg"), "invalid_level", 1024 * 1024);
    assert!(thumb.is_none());
}

#[test]
fn test_get_thumbnail_data_small_fallback_chain() {
    use exifpro_lib::exif::get_thumbnail_data;
    use std::path::Path;

    // 不存在的文件
    let thumb = get_thumbnail_data(Path::new("fake.jpg"), "small", 1024 * 1024);
    assert!(thumb.is_none());
}
