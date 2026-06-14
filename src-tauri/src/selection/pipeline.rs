use super::blur::Luma16Image;
use image::{DynamicImage, ImageBuffer};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use tauri_plugin_log::log;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ImageSource {
    Raw,
    SdrGamma,
    HdrLinear,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct NoiseBias {
    pub raw: f32,
    pub sdr_gamma: f32,
    pub hdr_linear: f32,
}

pub struct DetectionImage {
    pub raw: DynamicImage,
    pub luma: Luma16Image,
    pub source: ImageSource,
}

pub fn load_detection_image(path: &Path) -> Option<DetectionImage> {
    let ext = path.extension()?.to_str()?.to_lowercase();

    if crate::file_ops::is_raw_ext(&ext) {
        load_raw(path)
    } else {
        load_standard(path)
    }
}

fn load_raw(path: &Path) -> Option<DetectionImage> {
    log::debug!("pipeline.raw: start path={}", path.display());

    let raw = rawler::decode_file(path).ok()?;
    let w = raw.width;
    let h = raw.height;
    let cpp = raw.cpp;

    let data = match &raw.data {
        rawler::RawImageData::Integer(d) => d.clone(),
        _ => {
            log::warn!("pipeline.raw: non_integer_data path={}", path.display());
            return None;
        }
    };

    let cfa = &raw.camera.cfa;
    let black = raw.blacklevel.as_bayer_array();
    let wb = raw.wb_coeffs;

    let processed: Vec<u16> = match cpp {
        1 => {
            let mut buf = Vec::with_capacity(data.len());
            for y in 0..h {
                for x in 0..w {
                    let idx = y * w + x;
                    let cfa_idx = (y % cfa.height) * cfa.width + (x % cfa.width);
                    let pix = data[idx] as f32;
                    let p = (pix - black[cfa_idx]).max(0.0) * wb[cfa_idx];
                    buf.push((p.min(65535.0) as u16).min(65535));
                }
            }
            buf
        }
        _ => {
            log::warn!(
                "pipeline.raw: unsupported_cpp cpp={} path={}",
                cpp,
                path.display()
            );
            return None;
        }
    };

    let (luma, _) = resize_to_luma16(processed, w as u32, h as u32, 2000);

    log::debug!(
        "pipeline.raw: complete path={} w={} h={}",
        path.display(),
        w,
        h
    );

    let raw_img = DynamicImage::ImageLuma16(luma.clone());
    Some(DetectionImage {
        raw: raw_img,
        luma,
        source: ImageSource::Raw,
    })
}

fn load_standard(path: &Path) -> Option<DetectionImage> {
    log::debug!("pipeline.standard: start path={}", path.display());

    let img = image::ImageReader::open(path).ok()?.decode().ok()?;
    let (w, h) = (img.width(), img.height());
    let ext = path.extension()?.to_str()?.to_lowercase();

    let source = classify_source(&img, &ext, path)?;

    let luma = unify_image(img.clone(), w, h, source);

    log::debug!(
        "pipeline.standard: complete path={} source={:?}",
        path.display(),
        source
    );
    Some(DetectionImage {
        raw: img,
        luma,
        source,
    })
}

fn classify_source(img: &DynamicImage, ext: &str, path: &Path) -> Option<ImageSource> {
    match img {
        DynamicImage::ImageLuma8(_) | DynamicImage::ImageRgb8(_) | DynamicImage::ImageRgba8(_) => {
            Some(ImageSource::SdrGamma)
        }

        DynamicImage::ImageLuma16(_)
        | DynamicImage::ImageRgb16(_)
        | DynamicImage::ImageRgba16(_) => {
            if ext == "tif" || ext == "tiff" {
                probe_tiff_color(path)
            } else {
                Some(ImageSource::SdrGamma)
            }
        }

        DynamicImage::ImageRgb32F(_) | DynamicImage::ImageRgba32F(_) => {
            Some(ImageSource::HdrLinear)
        }

        _ => {
            log::warn!(
                "pipeline: unsupported_dynamic_image path={}",
                path.display()
            );
            None
        }
    }
}

fn probe_tiff_color(path: &Path) -> Option<ImageSource> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;

    for field in exif.fields() {
        if field.tag.number() == 0xA001 {
            let cs = field.value.get_uint(0)?;
            match cs {
                1 | 2 => return Some(ImageSource::SdrGamma),
                65535 => break,
                _ => return None,
            }
        }
    }

    for field in exif.fields() {
        if field.tag.number() == 0x8773 {
            return Some(classify_icc(&field.value));
        }
    }

    log::warn!(
        "pipeline: 16-bit TIFF no ICC/ColorSpace tag, skip path={}",
        path.display()
    );
    None
}

fn classify_icc(value: &exif::Value) -> ImageSource {
    let data = match value {
        exif::Value::Undefined(d, _) => d,
        _ => return ImageSource::SdrGamma,
    };
    let text = String::from_utf8_lossy(data);
    if text.contains("Linear") || text.contains("linear") {
        return ImageSource::HdrLinear;
    }
    ImageSource::SdrGamma
}

fn unify_image(img: DynamicImage, w: u32, h: u32, source: ImageSource) -> Luma16Image {
    let buf = convert_to_linear_luma16(img, source);
    let (luma, _) = resize_to_luma16(buf, w, h, 2000);
    luma
}

fn convert_to_linear_luma16(img: DynamicImage, source: ImageSource) -> Vec<u16> {
    match img {
        DynamicImage::ImageLuma16(buf) => {
            if source == ImageSource::HdrLinear {
                buf.into_raw()
            } else {
                buf.into_raw()
                    .into_iter()
                    .map(|p| {
                        let norm = p as f32 / 65535.0;
                        (srgb_gamma_to_linear(norm) * 65535.0) as u16
                    })
                    .collect()
            }
        }
        DynamicImage::ImageRgb16(buf) => {
            let raw = buf.into_raw();
            if source == ImageSource::HdrLinear {
                raw.chunks_exact(3)
                    .map(|ch| {
                        (0.2126 * ch[0] as f32 + 0.7152 * ch[1] as f32 + 0.0722 * ch[2] as f32)
                            as u16
                    })
                    .collect()
            } else {
                raw.chunks_exact(3)
                    .map(|ch| {
                        let r = srgb_gamma_to_linear(ch[0] as f32 / 65535.0);
                        let g = srgb_gamma_to_linear(ch[1] as f32 / 65535.0);
                        let b = srgb_gamma_to_linear(ch[2] as f32 / 65535.0);
                        ((0.2126 * r + 0.7152 * g + 0.0722 * b) * 65535.0) as u16
                    })
                    .collect()
            }
        }
        DynamicImage::ImageRgba16(buf) => {
            let raw = buf.into_raw();
            if source == ImageSource::HdrLinear {
                raw.chunks_exact(4)
                    .map(|ch| {
                        (0.2126 * ch[0] as f32 + 0.7152 * ch[1] as f32 + 0.0722 * ch[2] as f32)
                            as u16
                    })
                    .collect()
            } else {
                raw.chunks_exact(4)
                    .map(|ch| {
                        let r = srgb_gamma_to_linear(ch[0] as f32 / 65535.0);
                        let g = srgb_gamma_to_linear(ch[1] as f32 / 65535.0);
                        let b = srgb_gamma_to_linear(ch[2] as f32 / 65535.0);
                        ((0.2126 * r + 0.7152 * g + 0.0722 * b) * 65535.0) as u16
                    })
                    .collect()
            }
        }
        DynamicImage::ImageRgb8(buf) => buf
            .into_raw()
            .chunks_exact(3)
            .map(|ch| {
                let r = srgb_gamma_to_linear(ch[0] as f32 / 255.0);
                let g = srgb_gamma_to_linear(ch[1] as f32 / 255.0);
                let b = srgb_gamma_to_linear(ch[2] as f32 / 255.0);
                ((0.2126 * r + 0.7152 * g + 0.0722 * b) * 65535.0) as u16
            })
            .collect(),
        DynamicImage::ImageRgba8(buf) => buf
            .into_raw()
            .chunks_exact(4)
            .map(|ch| {
                let r = srgb_gamma_to_linear(ch[0] as f32 / 255.0);
                let g = srgb_gamma_to_linear(ch[1] as f32 / 255.0);
                let b = srgb_gamma_to_linear(ch[2] as f32 / 255.0);
                ((0.2126 * r + 0.7152 * g + 0.0722 * b) * 65535.0) as u16
            })
            .collect(),
        DynamicImage::ImageLuma8(buf) => buf
            .into_raw()
            .into_iter()
            .map(|p| {
                let norm = p as f32 / 255.0;
                (srgb_gamma_to_linear(norm) * 65535.0) as u16
            })
            .collect(),
        DynamicImage::ImageRgb32F(buf) => buf
            .into_raw()
            .chunks_exact(3)
            .map(|ch| (0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]).clamp(0.0, 1.0) as u16)
            .collect(),
        DynamicImage::ImageRgba32F(buf) => buf
            .into_raw()
            .chunks_exact(4)
            .map(|ch| (0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]).clamp(0.0, 1.0) as u16)
            .collect(),
        _ => Vec::new(),
    }
}

fn srgb_gamma_to_linear(c: f32) -> f32 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn resize_to_luma16(buf: Vec<u16>, w: u32, h: u32, max_px: u32) -> (Luma16Image, u32) {
    let img =
        ImageBuffer::from_raw(w, h, buf).expect("resize_to_luma16: buffer length must match w×h");
    let max_dim = w.max(h);
    if max_dim <= max_px {
        return (img, w);
    }
    let (w2, h2) = if w >= h {
        (max_px, ((h as u64 * max_px as u64) / w as u64) as u32)
    } else {
        (((w as u64 * max_px as u64) / h as u64) as u32, max_px)
    };
    let (w2, h2) = (w2.max(1), h2.max(1));
    (
        image::imageops::resize(&img, w2, h2, image::imageops::Lanczos3),
        w2,
    )
}
