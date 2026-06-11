use super::blur;
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
) -> Vec<SelectionResult> {
    let num_threads = if max_parallel > 0 {
        max_parallel as usize
    } else {
        std::thread::available_parallelism()
            .map(|n| n.get() / 4)
            .unwrap_or(4)
    };

    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(num_threads)
        .build()
        .expect("rayon pool creation");

    pool.install(|| {
        let results: Vec<Option<SelectionResult>> = files
            .par_iter()
            .map(|file_path| process_one(file_path, &algorithm, threshold, &noise_bias))
            .collect();
        results.into_iter().filter_map(|r| r).collect()
    })
}

fn process_one(
    file_path: &PathBuf,
    algorithm: &BlurAlgorithm,
    threshold: f32,
    noise_bias: &NoiseBias,
) -> Option<SelectionResult> {
    let (luma16, source) = pipeline::load_detection_image(file_path)?;

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

    log::info!(
        "{}: score_norm={:.6}, compensated={:.6}, passed={}",
        file_path.display(),
        score_norm,
        compensated,
        passed
    );

    Some(SelectionResult {
        file_path: file_path.to_string_lossy().to_string(),
        file_name: file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        score: compensated,
        score_details: vec![(method, compensated)],
        passed,
        eliminated_by,
    })
}
