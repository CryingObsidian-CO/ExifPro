use exif::Error;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExifInfo {
    pub file_path: String,
    pub file_name: String,
    pub capture_time: Option<String>,
    pub sub_time: Option<String>,
    pub shutter_speed: Option<String>,
    pub aperture: Option<String>,
    pub iso: Option<String>,
    pub exposure_compensation: Option<String>,
    pub focal_length: Option<String>,
    pub focus_distance: Option<String>,
    pub camera_make: Option<String>,
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
            shutter_speed: None,
            aperture: None,
            iso: None,
            exposure_compensation: None,
            focal_length: None,
            focus_distance: None,
            camera_make: None,
            camera_model: None,
        }
    }
}
pub fn parse_exif(file_path: &Path) -> Result<ExifInfo, Error> {
    let mut exif_info = ExifInfo::new(file_path);
    let file = File::open(file_path)?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader)?;

    // println!("\n\nEXIF tags for {}", exif_info.file_name);

    for field in exif.fields() {
        let tag = format!("{}", field.tag);
        let value = field.display_value().to_string();
        // println!("{}: {}", tag, value);

        match tag.as_str() {
            "DateTimeOriginal" => {
                exif_info.capture_time = Some(value);
            }
            "ExposureTime" => {
                exif_info.shutter_speed = Some(value);
            }
            "SubSecTimeOriginal" => {
                exif_info.sub_time = Some(value);
            }
            "FNumber" => {
                exif_info.aperture = Some(value);
            }
            "PhotographicSensitivity" => {
                exif_info.iso = Some(value);
            }
            "ExposureBiasValue" => {
                exif_info.exposure_compensation = Some(value);
            }
            "FocalLength" => {
                exif_info.focal_length = Some(value);
            }
            "SubjectDistance" => {
                exif_info.focus_distance = Some(value);
            }
            "Make" => {
                exif_info.camera_make = Some(value);
            }
            "Model" => {
                exif_info.camera_model = Some(value);
            }
            _ => {}
        }
    }
    Ok(exif_info)
}
