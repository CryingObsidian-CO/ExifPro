use super::blur;
use super::onnx::OnnxDetector;
use super::pipeline::{self, ImageSource, NoiseBias};
use super::{BlurAlgorithm, SelectionMethod, SelectionResult};
use rayon::prelude::*;
use std::path::PathBuf;
use tauri_plugin_log::log;

pub fn process_images(
    files: Vec<PathBuf>,
    algorithm: BlurAlgorithm,
    threshold: f32,
    noise_bias: NoiseBias,
    max_parallel: u32,
    onnx_model_path: &str,
    threshold_onnx: f32,
) -> Vec<SelectionResult> {
    let num_threads = if max_parallel > 0 {
        max_parallel as usize
    } else {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
    };

    let onnx_detector = if !onnx_model_path.is_empty() {
        match OnnxDetector::new(std::path::Path::new(onnx_model_path)) {
            Ok(d) => Some(d),
            Err(e) => {
                log::warn!("ONNX detector init failed, skipping: {}", e);
                None
            }
        }
    } else {
        None
    };

    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(num_threads)
        .build()
        .expect("rayon pool creation");

    pool.install(|| {
        let results: Vec<Option<SelectionResult>> = files
            .par_iter()
            .map(|file_path| {
                process_one(
                    file_path,
                    &algorithm,
                    threshold,
                    &noise_bias,
                    &onnx_detector,
                    threshold_onnx,
                )
            })
            .collect();
        results.into_iter().filter_map(|r| r).collect()
    })
}

fn process_one(
    file_path: &PathBuf,
    algorithm: &BlurAlgorithm,
    threshold: f32,
    noise_bias: &NoiseBias,
    onnx_detector: &Option<OnnxDetector>,
    threshold_onnx: f32,
) -> Option<SelectionResult> {
    let det_img = pipeline::load_detection_image(file_path)?;

    // ---- Blur detection ----
    let score_norm = blur::detect_blur(&det_img.luma, algorithm.clone());

    let bias = match det_img.source {
        ImageSource::Raw => noise_bias.raw,
        ImageSource::SdrGamma => noise_bias.sdr_gamma,
        ImageSource::HdrLinear => noise_bias.hdr_linear,
    };
    let blur_compensated = (score_norm - bias).max(0.0);
    let blur_passed = blur_compensated >= threshold;

    let mut score_details: Vec<(SelectionMethod, f32)> = Vec::new();
    let mut eliminated_by: Vec<SelectionMethod> = Vec::new();

    score_details.push((
        SelectionMethod::BlurDetection(algorithm.clone()),
        blur_compensated,
    ));
    if !blur_passed {
        eliminated_by.push(SelectionMethod::BlurDetection(algorithm.clone()));
    }

    // ---- ONNX detection ----
    if let Some(ref detector) = onnx_detector {
        match detector.predict(&det_img.raw) {
            Ok(onnx_score) => {
                let onnx_passed = onnx_score >= threshold_onnx;
                score_details.push((SelectionMethod::OnnxDetection, onnx_score));
                if !onnx_passed {
                    eliminated_by.push(SelectionMethod::OnnxDetection);
                }
                log::info!(
                    "{}: onnx_score={:.4}, passed={}",
                    file_path.display(),
                    onnx_score,
                    onnx_passed
                );
            }
            Err(e) => {
                log::warn!("ONNX predict failed for {}: {}", file_path.display(), e);
            }
        }
    }

    let passed = eliminated_by.is_empty();
    let overall_score = score_details
        .iter()
        .map(|(_, s)| *s)
        .fold(f32::MAX, f32::min);

    log::info!(
        "{}: blur={:.4} onnx={} passed={}",
        file_path.display(),
        blur_compensated,
        if score_details.len() > 1 {
            format!("{:.4}", score_details[1].1)
        } else {
            "N/A".to_string()
        },
        passed
    );

    Some(SelectionResult {
        file_path: file_path.to_string_lossy().to_string(),
        file_name: file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        score: overall_score,
        score_details,
        passed,
        eliminated_by,
    })
}
