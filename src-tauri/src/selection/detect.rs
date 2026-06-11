use super::blur;
use super::pipeline::{self, ImageSource, NoiseBias};
use super::{BlurAlgorithm, SelectionMethod, SelectionResult};
use std::path::PathBuf;
use tauri_plugin_log::log;

pub fn process_images(
    files: Vec<PathBuf>,
    algorithm: BlurAlgorithm,
    threshold: f32,
) -> Vec<SelectionResult> {
    let noise_bias = NoiseBias::default();
    let mut results = Vec::with_capacity(files.len());

    for file_path in files {
        let (luma16, source) = match pipeline::load_detection_image(&file_path) {
            Some(pair) => pair,
            None => {
                log::warn!("Failed to load detection image {}", file_path.display());
                continue;
            }
        };

        let score_norm = blur::detect_blur(&luma16, algorithm.clone());

        let bias = match source {
            ImageSource::Raw => noise_bias.raw,
            ImageSource::SdrGamma => noise_bias.sdr_gamma,
            ImageSource::HdrLinear => noise_bias.hdr_linear,
        };
        let compensated = (score_norm - bias).max(0.0);
        let passed = compensated >= threshold;

        let method = SelectionMethod::BlurDetection(algorithm.clone());
        let eliminated_by = if !passed {
            vec![method.clone()]
        } else {
            vec![]
        };

        results.push(SelectionResult {
            file_path: file_path.to_string_lossy().to_string(),
            file_name: file_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            score: compensated,
            score_details: vec![(method, compensated)],
            passed,
            eliminated_by,
        });

        log::debug!(
            "{}: score_norm={}, compensated={}, passed={}",
            file_path.display(),
            score_norm,
            compensated,
            passed
        );
    }

    results
}
