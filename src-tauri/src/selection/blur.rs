use super::BlurAlgorithm;

pub type Luma16Image = image::ImageBuffer<image::Luma<u16>, Vec<u16>>;

pub fn detect_blur(img: &Luma16Image, algorithm: BlurAlgorithm) -> f32 {
    match algorithm {
        BlurAlgorithm::LaplacianVariance => {
            let score = laplacian_variance(img);
            normalize_score(score, 0.0, 1048576.0 * 16.0)
        }
        BlurAlgorithm::Tenengrad => {
            let score = tenengrad(img);
            normalize_score(score, 0.0, 2097152.0 * 16.0)
        }
        BlurAlgorithm::Brenner => {
            let score = brenner(img);
            normalize_score(score, 0.0, 65536.0 * 256.0)
        }
    }
}

pub fn normalize_score(score: f32, min: f32, max: f32) -> f32 {
    if max <= min {
        return 0.5;
    }
    ((score - min) / (max - min)).clamp(0.0, 1.0)
}

fn laplacian_variance(img: &Luma16Image) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();
    let kernel: [[i32; 3]; 3] = [[0, -1, 0], [-1, 4, -1], [0, -1, 0]];

    let mut values = Vec::with_capacity((w.saturating_sub(2)) * (h.saturating_sub(2)));
    for y in 1..h.saturating_sub(1) {
        for x in 1..w.saturating_sub(1) {
            let mut sum: i64 = 0;
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = pixels[(y + ky - 1) * w + (x + kx - 1)] as i64;
                    sum += px * kernel[ky][kx] as i64;
                }
            }
            values.push(sum as f32);
        }
    }

    if values.is_empty() {
        return 0.0;
    }
    let n = values.len() as f32;
    let mean = values.iter().sum::<f32>() / n;
    values.iter().map(|v| (v - mean).powi(2)).sum::<f32>() / n
}

fn tenengrad(img: &Luma16Image) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();
    let sobel_x: [[i32; 3]; 3] = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    let sobel_y: [[i32; 3]; 3] = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    let mut sum: i64 = 0;
    let count = (w.saturating_sub(2)) * (h.saturating_sub(2));
    for y in 1..h.saturating_sub(1) {
        for x in 1..w.saturating_sub(1) {
            let mut gx: i64 = 0;
            let mut gy: i64 = 0;
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = pixels[(y + ky - 1) * w + (x + kx - 1)] as i64;
                    gx += px * sobel_x[ky][kx] as i64;
                    gy += px * sobel_y[ky][kx] as i64;
                }
            }
            sum += gx * gx + gy * gy;
        }
    }
    if count == 0 {
        return 0.0;
    }
    sum as f32 / count as f32
}

fn brenner(img: &Luma16Image) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();

    let mut sum: i64 = 0;
    let count = h * w.saturating_sub(2);
    for y in 0..h {
        let row = y * w;
        for x in 0..w.saturating_sub(2) {
            let diff = pixels[row + x] as i64 - pixels[row + x + 2] as i64;
            sum += diff * diff;
        }
    }
    if count == 0 {
        return 0.0;
    }
    sum as f32 / count as f32
}
