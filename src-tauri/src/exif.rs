use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use exif::{Error, Exif, In, Tag};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExifInfo {
    pub file_path: String,
    pub file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_time: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
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
            shutter_speed: None,
            aperture: None,
            iso: None,
            exposure_compensation: None,
            exposure_mode: None,
            focal_length: None,
            focus_distance: None,
            camera_make: None,
            camera_model: None,
            thumbnail: None,
        }
    }
}

fn extract_thumbnail(file_path: &Path, exif: &Exif) -> Option<String> {
    let thumb_offset = exif.get_field(Tag::JPEGInterchangeFormat, In::PRIMARY)?;
    let thumb_length = exif.get_field(Tag::JPEGInterchangeFormatLength, In::PRIMARY)?;

    let offset = thumb_offset.value.get_uint(0)? as u64;
    let length = thumb_length.value.get_uint(0)? as u64;

    if length <= 0 || offset <= 0 {
        return None;
    }

    let mut file = File::open(file_path).ok()?;
    file.seek(SeekFrom::Start(offset)).ok()?;

    let mut buf = vec![0u8; length as usize];
    match file.read_exact(&mut buf) {
        Ok(()) => {
            let mime = detect_mime_type(&buf);
            let encoded = BASE64.encode(&buf);
            Some(format!("data:{};base64,{}", mime, encoded))
        }
        Err(_) => None,
    }
}

fn detect_mime_type(data: &[u8]) -> &'static str {
    if data.len() >= 4 && &data[0..4] == b"\xff\xd8\xff" {
        "image/jpeg"
    } else if data.len() >= 8 && &data[0..8] == b"\x89PNG\r\n\x1a\n" {
        "image/png"
    } else {
        "image/jpeg"
    }
}

fn get_field_value(exif: &Exif, tag: Tag, in_: In) -> Option<String> {
    exif.get_field(tag, in_)
        .map(|field| field.display_value().to_string())
}

pub fn parse_exif(file_path: &Path) -> Result<ExifInfo, Error> {
    let mut exif_info = ExifInfo::new(file_path);
    let file = File::open(file_path)?;
    let mut buf_reader = BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut buf_reader)?;

    exif_info.capture_time = get_field_value(&exif, Tag::DateTimeOriginal, In::PRIMARY);
    exif_info.shutter_speed = get_field_value(&exif, Tag::ExposureTime, In::PRIMARY);
    exif_info.sub_time = get_field_value(&exif, Tag::SubSecTimeOriginal, In::PRIMARY);
    exif_info.aperture = get_field_value(&exif, Tag::FNumber, In::PRIMARY);
    exif_info.iso = get_field_value(&exif, Tag::PhotographicSensitivity, In::PRIMARY);
    exif_info.exposure_compensation = get_field_value(&exif, Tag::ExposureBiasValue, In::PRIMARY);
    exif_info.exposure_mode = exif
        .get_field(Tag::ExposureMode, In::PRIMARY)
        .and_then(|f| f.value.get_uint(0));
    exif_info.focal_length = get_field_value(&exif, Tag::FocalLength, In::PRIMARY);
    exif_info.focus_distance = get_field_value(&exif, Tag::SubjectDistance, In::PRIMARY);
    exif_info.camera_make = get_field_value(&exif, Tag::Make, In::PRIMARY);
    exif_info.camera_model = get_field_value(&exif, Tag::Model, In::PRIMARY);

    exif_info.thumbnail = extract_thumbnail(file_path, &exif);

    Ok(exif_info)
}
