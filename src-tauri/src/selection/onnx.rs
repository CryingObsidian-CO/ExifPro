use image::{imageops, DynamicImage};
use ndarray::Array4;
use ort::{inputs, session::Session, value::TensorRef};
use std::path::Path;
use std::sync::Mutex;
use tauri_plugin_log::log;

pub struct OnnxDetector {
    session: Mutex<Session>,
    input_size: u32,
}

impl OnnxDetector {
    pub fn new(model_path: &Path) -> Result<Self, String> {
        log::info!("onnx.load: start path={}", model_path.display());
        let session = Session::builder()
            .map_err(|e| format!("ORT builder create failed: {}", e))?
            .commit_from_file(model_path)
            .map_err(|e| format!("ORT load model failed: {}", e))?;
        log::info!("onnx.load: complete");
        Ok(Self {
            session: Mutex::new(session),
            input_size: 224,
        })
    }

    pub fn predict(&self, img: &DynamicImage) -> Result<f32, String> {
        let array = self.preprocess(img)?;
        let mut session = self
            .session
            .lock()
            .map_err(|e| format!("Mutex poisoned: {}", e))?;
        let tensor_ref = TensorRef::from_array_view(&array)
            .map_err(|e| format!("ORT create tensor failed: {}", e))?;
        let outputs = session
            .run(inputs![tensor_ref])
            .map_err(|e| format!("ORT inference failed: {}", e))?;

        let (_shape, data) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("ORT output read failed: {}", e))?;

        let vals: Vec<String> = data.iter().map(|v| format!("{:.4}", v)).collect();
        // TODO 提供一个更合适的评分方案
        let quality: f32 = data
            .iter()
            .enumerate()
            .filter(|(i, _)| *i >= 4)
            .map(|(_, p)| p)
            .sum();
        log::info!(
            "onnx.output: values=[{}], p(>=5)={:.4}",
            vals.join(", "),
            quality
        );
        Ok(quality)
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
