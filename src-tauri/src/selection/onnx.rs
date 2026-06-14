use image::{imageops, DynamicImage};
use ndarray::Array4;
use ort::{inputs, session::Session, value::TensorRef};
use tauri_plugin_log::log;

pub struct OnnxDetector {
    input_size: u32,
}

impl OnnxDetector {
    pub fn new() -> Self {
        Self { input_size: 224 }
    }

    pub fn predict(&self, session: &mut Session, img: &DynamicImage) -> Result<f32, String> {
        let array = self.preprocess(img)?;
        let tensor_ref = TensorRef::from_array_view(&array)
            .map_err(|e| format!("ORT create tensor failed: {}", e))?;
        let outputs = session
            .run(inputs![tensor_ref])
            .map_err(|e| format!("ORT inference failed: {}", e))?;

        let (_shape, data) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("ORT output read failed: {}", e))?;

        let vals: Vec<String> = data.iter().map(|v| format!("{:.4}", v)).collect();
        let mean: f32 = data
            .iter()
            .enumerate()
            .map(|(i, p)| (i as f32 + 1.0) * p)
            .sum();
        let stars = ((mean - 1.0) * 5.0 / 9.0 * 100.0).round() / 100.0;
        log::info!(
            "onnx.output: values=[{}], mean={:.4}, stars={:.2}",
            vals.join(", "),
            mean,
            stars
        );
        Ok(stars)
    }

    fn preprocess(&self, img: &DynamicImage) -> Result<Array4<f32>, String> {
        let size = self.input_size as usize;
        let resized = img.resize_exact(
            self.input_size,
            self.input_size,
            imageops::FilterType::Lanczos3,
        );
        let rgb = resized.to_rgb8();
        let pixels = rgb.into_raw();

        let mut data = vec![0.0f32; 3 * size * size];
        for y in 0..size {
            for x in 0..size {
                let idx = y * size + x;
                for c in 0..3 {
                    data[idx * 3 + c] = (pixels[idx * 3 + c] as f32 / 127.5) - 1.0;
                }
            }
        }

        Array4::from_shape_vec([1, size, size, 3], data)
            .map_err(|e| format!("Failed to create input tensor: {}", e))
    }
}

pub fn create_gpu_session(model_bytes: &[u8]) -> Result<Session, String> {
    let mut builder = Session::builder().map_err(|e| format!("ORT builder: {}", e))?;

    let dml_ep = ort::ep::DirectML::default().build().error_on_failure();
    if let Ok(mut b) = builder.clone().with_execution_providers([dml_ep]) {
        if let Ok(session) = b.commit_from_memory(model_bytes) {
            log::info!("onnx.gpu: DirectML EP enabled");
            return Ok(session);
        }
    }
    log::warn!("onnx.gpu: DirectML unavailable, falling back to CPU");

    builder
        .commit_from_memory(model_bytes)
        .map_err(|e| format!("ORT session: {}", e))
}

pub fn create_cpu_session(model_bytes: &[u8]) -> Result<Session, String> {
    Session::builder()
        .map_err(|e| format!("ORT builder: {}", e))?
        .commit_from_memory(model_bytes)
        .map_err(|e| format!("ORT session: {}", e))
}
