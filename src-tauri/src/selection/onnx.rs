use image::{imageops, DynamicImage};
use std::path::Path;
use std::sync::Arc;
use tauri_plugin_log::log;
use tract_onnx::prelude::*;
use tract_onnx::tract_core::plan::SimplePlan;

type OnnxModel = Arc<SimplePlan<TypedFact, Box<dyn TypedOp>>>;

pub struct OnnxDetector {
    model: OnnxModel,
    input_size: u32,
}

impl OnnxDetector {
    pub fn new(model_path: &Path) -> Result<Self, String> {
        log::info!("onnx.load: start path={}", model_path.display());

        let input_size = 224u32;
        let model = onnx()
            .model_for_path(model_path)
            .map_err(|e| format!("Failed to load ONNX model: {}", e))?
            .with_input_fact(
                0,
                InferenceFact::dt_shape(
                    f32::datum_type(),
                    tvec!(1i64, 3, input_size as i64, input_size as i64),
                ),
            )
            .map_err(|e| format!("Failed to set ONNX input fact: {}", e))?
            .into_optimized()
            .map_err(|e| format!("Failed to optimize ONNX model: {}", e))?
            .into_runnable()
            .map_err(|e| format!("Failed to make ONNX runnable: {}", e))?;

        log::info!("onnx.load: complete");
        Ok(Self { model, input_size })
    }

    pub fn predict(&self, img: &DynamicImage) -> Result<f32, String> {
        let tensor = self.preprocess(img)?;
        let result = self
            .model
            .run(tvec!(tensor.into()))
            .map_err(|e| format!("ONNX inference failed: {}", e))?;

        let output = result[0]
            .to_plain_array_view::<f32>()
            .map_err(|e| format!("ONNX output read failed: {}", e))?;

        let score: f32 = output
            .iter()
            .enumerate()
            .map(|(i, &p)| (i as f32 + 1.0) * p)
            .sum();

        Ok((score - 1.0) / 9.0)
    }

    fn preprocess(&self, img: &DynamicImage) -> Result<Tensor, String> {
        let size = self.input_size as usize;
        let resized = img.resize_exact(
            self.input_size,
            self.input_size,
            imageops::FilterType::Lanczos3,
        );
        let rgb = resized.to_rgb8();
        let pixels = rgb.into_raw();

        let mean: [f32; 3] = [0.485, 0.456, 0.406];
        let std: [f32; 3] = [0.229, 0.224, 0.225];

        let mut data = vec![0.0f32; 3 * size * size];
        for y in 0..size {
            for x in 0..size {
                let idx = y * size + x;
                for c in 0..3 {
                    let val = pixels[idx * 3 + c] as f32 / 255.0;
                    data[c * size * size + idx] = (val - mean[c]) / std[c];
                }
            }
        }

        let arr = tract_ndarray::Array4::from_shape_vec([1usize, 3, size, size], data)
            .map_err(|e| format!("Failed to create input tensor: {}", e))?;

        Ok(arr.into())
    }
}
