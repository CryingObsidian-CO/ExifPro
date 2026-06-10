pub mod blur;

#[derive(Debug, Clone)]
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

pub struct SelectionResult {
    pub file_path: String,
    pub score: f32,
    pub score_details: Vec<(SelectionMethod, f32)>,
    pub passed: bool,
    pub eliminated_by: Vec<SelectionMethod>,
}

pub struct SelectionRating {
    pub file_path: String,
    pub stars: u8,
}
