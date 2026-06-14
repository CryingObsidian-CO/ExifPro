use super::blur;
use super::onnx::{self, OnnxDetector};
use super::pipeline::{self, ImageSource, NoiseBias};
use super::{BlurAlgorithm, SelectionMethod, SelectionResult};
use rayon::prelude::*;
use std::cell::RefCell;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri_plugin_log::log;

thread_local! {
    static CPU_SESSION: RefCell<Option<ort::session::Session>> = const { RefCell::new(None) };
}

pub fn process_images(
    files: Vec<PathBuf>,
    algorithm: BlurAlgorithm,
    threshold: f32,
    noise_bias: NoiseBias,
    max_parallel: u32,
    onnx_model_path: &str,
    threshold_onnx: f32,
    onnx_gpu: bool,
) -> Vec<SelectionResult> {
    let num_threads = if max_parallel > 0 {
        max_parallel as usize
    } else {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
    };

    let onnx_ctx = if !onnx_model_path.is_empty() {
        match std::fs::read(onnx_model_path) {
            Ok(bytes) => {
                let bytes = Arc::new(bytes);
                if onnx_gpu {
                    match onnx::create_gpu_session(&bytes) {
                        Ok(session) => Some(OnnxCtx::Gpu {
                            session: Mutex::new(session),
                            detector: OnnxDetector::new(),
                            threshold: threshold_onnx,
                        }),
                        Err(e) => {
                            log::warn!("ONNX GPU init failed, skipping: {}", e);
                            None
                        }
                    }
                } else {
                    Some(OnnxCtx::Cpu {
                        bytes,
                        detector: OnnxDetector::new(),
                        threshold: threshold_onnx,
                    })
                }
            }
            Err(e) => {
                log::warn!("ONNX model read failed, skipping: {}", e);
                None
            }
        }
    } else {
        None
    };

    let pool = match rayon::ThreadPoolBuilder::new()
        .num_threads(num_threads)
        .build()
    {
        Ok(p) => p,
        Err(e) => {
            log::error!("Failed to create rayon pool: {}", e);
            return Vec::new();
        }
    };

    pool.install(|| {
        let results: Vec<Option<SelectionResult>> = files
            .par_iter()
            .map(|file_path| process_one(file_path, &algorithm, threshold, &noise_bias, &onnx_ctx))
            .collect();
        results.into_iter().filter_map(|r| r).collect()
    })
}

enum OnnxCtx {
    Gpu {
        session: Mutex<ort::session::Session>,
        detector: OnnxDetector,
        threshold: f32,
    },
    Cpu {
        bytes: Arc<Vec<u8>>,
        detector: OnnxDetector,
        threshold: f32,
    },
}

fn process_one(
    file_path: &PathBuf,
    algorithm: &BlurAlgorithm,
    threshold: f32,
    noise_bias: &NoiseBias,
    onnx_ctx: &Option<OnnxCtx>,
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
    if let Some(ref ctx) = onnx_ctx {
        let onnx_result = match ctx {
            OnnxCtx::Gpu {
                session, detector, ..
            } => {
                let session = session.lock().map_err(|e| format!("Mutex: {}", e));
                session.and_then(|mut s| detector.predict(&mut s, &det_img.raw).map_err(|e| e))
            }
            OnnxCtx::Cpu {
                bytes, detector, ..
            } => CPU_SESSION.with(|cell| {
                let mut session = cell.borrow_mut();
                if session.is_none() {
                    *session = onnx::create_cpu_session(bytes).ok();
                }
                session
                    .as_mut()
                    .map(|s| detector.predict(s, &det_img.raw))
                    .unwrap_or_else(|| Err("CPU session init failed".to_string()))
            }),
        };

        match onnx_result {
            Ok(onnx_score) => {
                let t = match ctx {
                    OnnxCtx::Gpu { threshold, .. } => *threshold,
                    OnnxCtx::Cpu { threshold, .. } => *threshold,
                };
                score_details.push((SelectionMethod::OnnxDetection, onnx_score));
                let onnx_passed = onnx_score >= t;
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
