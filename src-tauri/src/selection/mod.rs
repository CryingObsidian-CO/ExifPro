pub mod blur;
pub mod detect;
pub mod pipeline;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlurAlgorithm {
    LaplacianVariance,
    Tenengrad,
    Brenner,
}

#[derive(Debug, Clone)]
pub enum SelectionMethod {
    BlurDetection(BlurAlgorithm),
    OnnxDetection,
}

impl Serialize for SelectionMethod {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            SelectionMethod::BlurDetection(_) => serializer.serialize_str("BlurDetection"),
            SelectionMethod::OnnxDetection => serializer.serialize_str("OnnxDetection"),
        }
    }
}

impl<'de> Deserialize<'de> for SelectionMethod {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        match s.as_str() {
            "BlurDetection" => Ok(SelectionMethod::BlurDetection(
                BlurAlgorithm::LaplacianVariance,
            )),
            "OnnxDetection" => Ok(SelectionMethod::OnnxDetection),
            _ => Err(serde::de::Error::custom(format!(
                "unknown selection method: {}",
                s
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SelectionResult {
    pub file_path: String,
    pub file_name: String,
    pub score: f32,
    pub score_details: Vec<(SelectionMethod, f32)>,
    pub passed: bool,
    pub eliminated_by: Vec<SelectionMethod>,
}

pub struct SelectionRating {
    pub file_path: String,
    pub stars: u8,
}

pub fn convert_algorithm(s: &str) -> Result<BlurAlgorithm, String> {
    match s {
        "LaplacianVariance" => Ok(BlurAlgorithm::LaplacianVariance),
        "Tenengrad" => Ok(BlurAlgorithm::Tenengrad),
        "Brenner" => Ok(BlurAlgorithm::Brenner),
        _ => Err(format!("Unknown blur algorithm: {}", s)),
    }
}

pub use pipeline::{ImageSource, NoiseBias};
