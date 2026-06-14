use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use exif::{Error, Exif, In, Tag};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::Path;
use tauri_plugin_log::log;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExifInfo {
    pub file_path: String,
    pub file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset_time_original: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shutter_speed: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aperture: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iso: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exposure_compensation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exposure_mode: Option<u32>,
    pub focal_length: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focus_distance: Option<String>,
    pub camera_make: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera_model: Option<String>,
}

impl ExifInfo {
    pub fn new(file_path: &Path) -> Self {
        let file_name = file_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .to_string();

        ExifInfo {
            file_path: file_path.to_string_lossy().to_string(),
            file_name,
            capture_time: None,
            sub_time: None,
            offset_time_original: None,
            shutter_speed: None,
            aperture: None,
            iso: None,
            exposure_compensation: None,
            exposure_mode: None,
            focal_length: None,
            focus_distance: None,
            camera_make: None,
            camera_model: None,
        }
    }
}

fn is_previewable_extension(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let previewable_exts = [
        "jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "heic", "heif",
    ];
    previewable_exts.contains(&ext.as_str())
}

// TODO 考虑超大文件的提示处理
// TODO 对于超大文件，利用插件生成小文件后显示
fn extract_file_preview(file_path: &Path, max_preview_bytes: u64) -> Option<String> {
    if max_preview_bytes == 0 {
        return None;
    }
    if !is_previewable_extension(file_path) {
        return None;
    }
    let metadata = fs::metadata(file_path).ok()?;
    if metadata.len() > max_preview_bytes {
        log::debug!(
            "exif.preview: skip_too_large file={} size={} max={}",
            file_path.display(),
            metadata.len(),
            max_preview_bytes
        );
        return None;
    }
    log::debug!(
        "exif.preview: start file={} size={}",
        file_path.display(),
        metadata.len()
    );
    let mut file = match File::open(file_path) {
        Ok(f) => f,
        Err(e) => {
            log::warn!(
                "exif.preview: open_failed file={} err={}",
                file_path.display(),
                e
            );
            return None;
        }
    };
    let mut buf = Vec::new();
    if file.read_to_end(&mut buf).is_err() {
        log::warn!("exif.preview: read_failed file={}", file_path.display());
        return None;
    }
    if buf.is_empty() {
        return None;
    }
    let mime = detect_mime_type(&buf);
    let encoded = BASE64.encode(&buf);
    log::debug!(
        "exif.preview: complete file={} mime={} size={}",
        file_path.display(),
        mime,
        buf.len()
    );
    Some(format!("data:{};base64,{}", mime, encoded))
}

fn extract_raw_jpeg(exif: &Exif, ifd: In) -> Option<Vec<u8>> {
    let thumb_offset = exif.get_field(Tag::JPEGInterchangeFormat, ifd)?;
    let thumb_length = exif.get_field(Tag::JPEGInterchangeFormatLength, ifd)?;

    let offset = thumb_offset.value.get_uint(0)? as usize;
    let length = thumb_length.value.get_uint(0)? as usize;

    if length == 0 || offset == 0 {
        return None;
    }

    let exif_buf = exif.buf();
    let end = offset.saturating_add(length);
    if end > exif_buf.len() {
        return None;
    }

    Some(exif_buf[offset..end].to_vec())
}

fn extract_thumbnail(file_path: &Path, exif: &Exif, ifd: In) -> Option<String> {
    let jpeg_data = extract_raw_jpeg(exif, ifd)?;
    let mime = detect_mime_type(&jpeg_data);
    let encoded = BASE64.encode(&jpeg_data);
    log::debug!(
        "exif.thumbnail: complete file={} ifd={:?} size={}",
        file_path.display(),
        ifd,
        jpeg_data.len()
    );
    Some(format!("data:{};base64,{}", mime, encoded))
}

fn detect_mime_type(data: &[u8]) -> &'static str {
    if data.len() >= 4 && &data[0..4] == b"\xff\xd8\xff\xdb" {
        "image/jpeg"
    } else if data.len() >= 8 && &data[0..8] == b"\x89PNG\r\n\x1a\n" {
        "image/png"
    } else if data.len() >= 3 && &data[0..3] == b"GIF" {
        "image/gif"
    } else if data.len() >= 4
        && &data[0..4] == b"RIFF"
        && data.len() >= 12
        && &data[8..12] == b"WEBP"
    {
        "image/webp"
    } else {
        "image/jpeg"
    }
}

fn enhance_prase_focus_distance(exif: &Exif, camera_make: &str) -> Option<String> {
    log::debug!("exif.focus_distance: enhance make={}", camera_make);
    match camera_make {
        "SONY" => {
            let _makernote = get_field_value(&exif, Tag::MakerNote, In::PRIMARY)?;
            // TODO 去除这一部分改为插件实现了对焦距离解析
            None
        }
        _ => None,
    }
}

fn get_field_value(exif: &Exif, tag: Tag, in_: In) -> Option<String> {
    exif.get_field(tag, in_)
        .map(|field| field.display_value().to_string())
}

// 解决字段包含引号的问题
fn to_clean_text(value: Option<String>) -> Option<String> {
    if let Some(text) = value {
        let clean_text = text
            .trim_matches(|c| c == '"' || c == '\'')
            .trim()
            .to_string();
        Some(clean_text)
    } else {
        None
    }
}

fn normalize_sub_time(value: Option<String>, digits: usize) -> Option<String> {
    let cleaned = to_clean_text(value)?;
    let digits_only: String = cleaned.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits_only.is_empty() {
        return None;
    }
    if digits_only.len() >= digits {
        Some(digits_only[..digits].to_string())
    } else {
        Some(format!("{:0<width$}", digits_only, width = digits))
    }
}

pub fn parse_exif(file_path: &Path) -> Result<ExifInfo, Error> {
    log::debug!("exif.parse: start file={}", file_path.display());
    let mut exif_info = ExifInfo::new(file_path);
    let file = File::open(file_path)?;
    let mut buf_reader = BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut buf_reader)?;

    /*
        // 打印所有字段
        for field in exif.fields() {
            let tag = field.tag.to_string();
            let value = field.display_value().to_string();
            println!("{}: {}", tag, value);
        }
        println!("\n\n");
    */

    exif_info.capture_time = get_field_value(&exif, Tag::DateTimeOriginal, In::PRIMARY);
    exif_info.sub_time = Some(
        normalize_sub_time(
            get_field_value(&exif, Tag::SubSecTimeOriginal, In::PRIMARY),
            6,
        )
        .unwrap_or_else(|| "000000".to_string()),
    );
    exif_info.offset_time_original =
        to_clean_text(get_field_value(&exif, Tag::OffsetTimeOriginal, In::PRIMARY));
    exif_info.shutter_speed = get_field_value(&exif, Tag::ExposureTime, In::PRIMARY);
    exif_info.aperture = get_field_value(&exif, Tag::FNumber, In::PRIMARY);
    exif_info.iso = get_field_value(&exif, Tag::PhotographicSensitivity, In::PRIMARY);
    exif_info.exposure_compensation = get_field_value(&exif, Tag::ExposureBiasValue, In::PRIMARY);
    exif_info.exposure_mode = exif
        .get_field(Tag::ExposureMode, In::PRIMARY)
        .and_then(|f| f.value.get_uint(0));
    exif_info.focal_length = get_field_value(&exif, Tag::FocalLength, In::PRIMARY);
    exif_info.focus_distance = get_field_value(&exif, Tag::SubjectDistance, In::PRIMARY);
    exif_info.camera_make = to_clean_text(get_field_value(&exif, Tag::Make, In::PRIMARY));
    exif_info.camera_model = to_clean_text(get_field_value(&exif, Tag::Model, In::PRIMARY));

    if exif_info.focus_distance.is_none() && exif_info.camera_make.is_some() {
        exif_info.focus_distance =
            enhance_prase_focus_distance(&exif, exif_info.camera_make.as_ref().unwrap());
    }

    log::debug!("exif.parse: complete file={}", file_path.display());
    Ok(exif_info)
}

pub fn get_thumbnail_data(file_path: &Path, level: &str, max_preview_bytes: u64) -> Option<String> {
    let file = File::open(file_path).ok()?;
    let mut buf_reader = BufReader::new(file);

    let (primary_thumb, small_thumb) = exif::Reader::new()
        .read_from_container(&mut buf_reader)
        .ok()
        .map(|exif_data| {
            let primary = extract_thumbnail(file_path, &exif_data, In::PRIMARY);
            let small = extract_thumbnail(file_path, &exif_data, In::THUMBNAIL);
            (primary, small)
        })
        .unwrap_or((None, None));

    // NOTE 这么设计回退的目的是确保能拿到不低于要求级别的缩率图
    match level {
        "small" => small_thumb
            .or(primary_thumb)
            .or_else(|| extract_file_preview(file_path, max_preview_bytes)),
        "large" => primary_thumb.or_else(|| extract_file_preview(file_path, u64::MAX)),
        _ => {
            log::warn!("exif.thumbnail: unknown_level level={}", level);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_mime_type_jpeg() {
        let data = [0xFF, 0xD8, 0xFF, 0xDB, 0x00];
        assert_eq!(detect_mime_type(&data), "image/jpeg");
    }

    #[test]
    fn test_detect_mime_type_png() {
        let data = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];
        assert_eq!(detect_mime_type(&data), "image/png");
    }

    #[test]
    fn test_detect_mime_type_gif() {
        let data = [0x47, 0x49, 0x46, 0x38];
        assert_eq!(detect_mime_type(&data), "image/gif");
    }

    #[test]
    fn test_detect_mime_type_webp() {
        let mut data = Vec::from(b"RIFF");
        data.extend_from_slice(&[0x00; 4]);
        data.extend_from_slice(b"WEBP");
        assert_eq!(detect_mime_type(&data), "image/webp");
    }

    #[test]
    fn test_detect_mime_type_fallback() {
        assert_eq!(detect_mime_type(b"unknown"), "image/jpeg");
    }

    #[test]
    fn test_detect_mime_type_empty() {
        assert_eq!(detect_mime_type(&[]), "image/jpeg");
    }

    #[test]
    fn test_normalize_sub_time_none() {
        assert_eq!(normalize_sub_time(None, 6), None);
    }

    #[test]
    fn test_normalize_sub_time_pad_short() {
        assert_eq!(
            normalize_sub_time(Some("123".to_string()), 6),
            Some("123000".to_string())
        );
    }

    #[test]
    fn test_normalize_sub_time_truncate_long() {
        assert_eq!(
            normalize_sub_time(Some("1234567".to_string()), 6),
            Some("123456".to_string())
        );
    }

    #[test]
    fn test_normalize_sub_time_exact_length() {
        assert_eq!(
            normalize_sub_time(Some("123456".to_string()), 6),
            Some("123456".to_string())
        );
    }

    #[test]
    fn test_normalize_sub_time_filter_non_digit() {
        assert_eq!(
            normalize_sub_time(Some("ab12cd34".to_string()), 6),
            Some("123400".to_string())
        );
    }

    #[test]
    fn test_normalize_sub_time_empty_after_filter() {
        assert_eq!(normalize_sub_time(Some("abc".to_string()), 6), None);
    }

    #[test]
    fn test_normalize_sub_time_custom_digits() {
        assert_eq!(
            normalize_sub_time(Some("99".to_string()), 3),
            Some("990".to_string())
        );
    }

    #[test]
    fn test_to_clean_text_none() {
        assert_eq!(to_clean_text(None), None);
    }

    #[test]
    fn test_to_clean_text_trim_double_quotes() {
        assert_eq!(
            to_clean_text(Some("\"SONY\"".to_string())),
            Some("SONY".to_string())
        );
    }

    #[test]
    fn test_to_clean_text_trim_single_quotes() {
        assert_eq!(
            to_clean_text(Some("'Model'".to_string())),
            Some("Model".to_string())
        );
    }

    #[test]
    fn test_to_clean_text_no_quotes() {
        assert_eq!(
            to_clean_text(Some("hello".to_string())),
            Some("hello".to_string())
        );
    }

    #[test]
    fn test_to_clean_text_trim_whitespace() {
        assert_eq!(
            to_clean_text(Some("  spaced  ".to_string())),
            Some("spaced".to_string())
        );
    }

    #[test]
    fn test_to_clean_text_quotes_and_spaces() {
        assert_eq!(
            to_clean_text(Some("  \"quoted\"  ".to_string())),
            Some("\"quoted\"".to_string())
        );
    }

    #[test]
    fn test_to_clean_text_empty_string() {
        assert_eq!(to_clean_text(Some("".to_string())), Some("".to_string()));
    }

    #[test]
    fn test_is_previewable_extension_jpg() {
        assert!(is_previewable_extension(Path::new("photo.jpg")));
    }

    #[test]
    fn test_is_previewable_extension_jpeg() {
        assert!(is_previewable_extension(Path::new("photo.jpeg")));
    }

    #[test]
    fn test_is_previewable_extension_uppercase() {
        assert!(is_previewable_extension(Path::new("photo.JPG")));
    }

    #[test]
    fn test_is_previewable_extension_png() {
        assert!(is_previewable_extension(Path::new("photo.png")));
    }

    #[test]
    fn test_is_previewable_extension_gif() {
        assert!(is_previewable_extension(Path::new("photo.gif")));
    }

    #[test]
    fn test_is_previewable_extension_bmp() {
        assert!(is_previewable_extension(Path::new("photo.bmp")));
    }

    #[test]
    fn test_is_previewable_extension_tiff() {
        assert!(is_previewable_extension(Path::new("photo.tiff")));
    }

    #[test]
    fn test_is_previewable_extension_webp() {
        assert!(is_previewable_extension(Path::new("photo.webp")));
    }

    #[test]
    fn test_is_previewable_extension_heic() {
        assert!(is_previewable_extension(Path::new("photo.heic")));
    }

    #[test]
    fn test_is_previewable_extension_heif() {
        assert!(is_previewable_extension(Path::new("photo.heif")));
    }

    #[test]
    fn test_is_previewable_extension_non_previewable() {
        assert!(!is_previewable_extension(Path::new("document.pdf")));
    }

    #[test]
    fn test_is_previewable_extension_no_extension() {
        assert!(!is_previewable_extension(Path::new("Makefile")));
    }

    #[test]
    fn test_is_previewable_extension_cr2_raw() {
        assert!(!is_previewable_extension(Path::new("photo.cr2")));
    }

    #[test]
    fn test_is_previewable_extension_arw_raw() {
        assert!(!is_previewable_extension(Path::new("photo.arw")));
    }

    struct TestDir(std::path::PathBuf);

    impl TestDir {
        fn new() -> Self {
            let base = std::env::temp_dir();
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = base.join(format!("exif_unit_{}", ts));
            fs::create_dir_all(&path).unwrap();
            TestDir(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }

        fn create_file(&self, name: &str, data: &[u8]) -> std::path::PathBuf {
            let p = self.path().join(name);
            fs::write(&p, data).unwrap();
            p
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn test_get_thumbnail_data_real_file_large() {
        let dir = TestDir::new();
        let path = dir.create_file("test.jpg", &[0xFF, 0xD8, 0xFF, 0xDB, 0x00]);
        let result = get_thumbnail_data(&path, "large", 1024 * 1024);
        assert!(result.is_some());
        let data = result.unwrap();
        assert!(data.starts_with("data:image/jpeg;base64,"));
    }

    #[test]
    fn test_get_thumbnail_data_real_file_small() {
        let dir = TestDir::new();
        let path = dir.create_file("test.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0DIHDR");
        let result = get_thumbnail_data(&path, "small", 1024 * 1024);
        assert!(result.is_some());
        let data = result.unwrap();
        assert!(data.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn test_get_thumbnail_data_file_too_large_for_preview() {
        let dir = TestDir::new();
        let data: Vec<u8> = (0..100u8).collect();
        let path = dir.create_file("large.jpg", &data);
        let result = get_thumbnail_data(&path, "small", 50);
        assert!(result.is_none());
    }

    #[test]
    fn test_get_thumbnail_data_non_previewable_ext() {
        let dir = TestDir::new();
        let path = dir.create_file("document.pdf", b"%PDF-1.4");
        let result = get_thumbnail_data(&path, "large", 1024 * 1024);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_file_preview_max_preview_zero() {
        let dir = TestDir::new();
        let path = dir.create_file("test.jpg", &[0xFF, 0xD8, 0xFF]);
        let result = get_thumbnail_data(&path, "small", 0);
        assert!(result.is_none());
    }
}
