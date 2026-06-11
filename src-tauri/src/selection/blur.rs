use super::BlurAlgorithm;

pub type Luma16Image = image::ImageBuffer<image::Luma<u16>, Vec<u16>>;

pub fn detect_blur(img: &Luma16Image, algorithm: BlurAlgorithm) -> f32 {
    let mild = image::imageops::blur(img, 0.5);
    let strong = image::imageops::blur(img, 3.0);

    match algorithm {
        BlurAlgorithm::LaplacianVariance => {
            let m = mean_abs_laplacian(&mild);
            let s = mean_abs_laplacian(&strong);
            let ratio = if s < 1.0 { 0.0 } else { m / s };
            log::info!(
                "LaplacianScore: mean_mild={:.2} mean_strong={:.2} ratio={:.2}",
                m,
                s,
                ratio
            );
            normalize_score(ratio, 0.0, 20.0)
        }
        BlurAlgorithm::Tenengrad => {
            let m = mean_tenengrad(&mild);
            let s = mean_tenengrad(&strong);
            let ratio = if s < 1.0 { 0.0 } else { m / s };
            log::info!(
                "TenengradScore: mean_mild={:.2} mean_strong={:.2} ratio={:.2}",
                m,
                s,
                ratio
            );
            normalize_score(ratio, 0.0, 20.0)
        }
        BlurAlgorithm::Brenner => {
            let m = mean_brenner(&mild);
            let s = mean_brenner(&strong);
            let ratio = if s < 1.0 { 0.0 } else { m / s };
            log::info!(
                "BrennerScore: mean_mild={:.2} mean_strong={:.2} ratio={:.2}",
                m,
                s,
                ratio
            );
            normalize_score(ratio, 0.0, 15.0)
        }
    }
}

pub fn normalize_score(score: f32, min: f32, max: f32) -> f32 {
    if max <= min {
        return 0.5;
    }
    ((score - min) / (max - min)).clamp(0.0, 1.0)
}

fn mean_abs_laplacian(img: &Luma16Image) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();
    let kernel: [[i32; 3]; 3] = [[0, -1, 0], [-1, 4, -1], [0, -1, 0]];

    let count = (w.saturating_sub(2)) * (h.saturating_sub(2));
    if count == 0 {
        return 0.0;
    }

    let mut sum: u64 = 0;
    for y in 1..h.saturating_sub(1) {
        for x in 1..w.saturating_sub(1) {
            let mut lap: i64 = 0;
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = pixels[(y + ky - 1) * w + (x + kx - 1)] as i64;
                    lap += px * kernel[ky][kx] as i64;
                }
            }
            sum += lap.unsigned_abs();
        }
    }
    sum as f32 / count as f32
}

fn mean_tenengrad(img: &Luma16Image) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();
    let sobel_x: [[i32; 3]; 3] = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    let sobel_y: [[i32; 3]; 3] = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    let count = (w.saturating_sub(2)) * (h.saturating_sub(2));
    if count == 0 {
        return 0.0;
    }

    let mut sum: f64 = 0.0;
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
            sum += ((gx * gx + gy * gy) as f64).sqrt();
        }
    }
    (sum / count as f64) as f32
}

fn mean_brenner(img: &Luma16Image) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();

    let count = h * w.saturating_sub(2);
    if count == 0 {
        return 0.0;
    }

    let mut sum: u64 = 0;
    for y in 0..h {
        let row = y * w;
        for x in 0..w.saturating_sub(2) {
            let diff = (pixels[row + x] as i64 - pixels[row + x + 2] as i64).unsigned_abs();
            sum += diff;
        }
    }
    sum as f32 / count as f32
}
