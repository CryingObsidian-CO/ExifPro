use super::BlurAlgorithm;
use image::GrayImage;

pub fn detect_blur(img: &GrayImage, algorithm: BlurAlgorithm) -> f32 {
    match algorithm {
        BlurAlgorithm::LaplacianVariance => {
            let score = laplacian_variance(img);
            normalize_score(score, 0.0, 1040400.0)
        }
        BlurAlgorithm::Tenengrad => {
            let score = tenengrad(img);
            normalize_score(score, 0.0, 2080800.0)
        }
        BlurAlgorithm::Brenner => {
            let score = brenner(img);
            normalize_score(score, 0.0, 65025.0)
        }
    }
}

pub fn normalize_score(score: f32, min: f32, max: f32) -> f32 {
    if max <= min {
        return 0.5;
    }
    ((score - min) / (max - min)).clamp(0.0, 1.0)
}

fn laplacian_variance(img: &GrayImage) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();
    let kernel: [[i32; 3]; 3] = [[0, -1, 0], [-1, 4, -1], [0, -1, 0]];

    let mut values = Vec::with_capacity((w - 2) * (h - 2));
    for y in 1..h - 1 {
        for x in 1..w - 1 {
            let mut sum = 0i32;
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = pixels[(y + ky - 1) * w + (x + kx - 1)] as i32;
                    sum += px * kernel[ky][kx];
                }
            }
            values.push(sum as f32);
        }
    }

    let n = values.len() as f32;
    let mean = values.iter().sum::<f32>() / n;
    values.iter().map(|v| (v - mean).powi(2)).sum::<f32>() / n
}

fn tenengrad(img: &GrayImage) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();
    let sobel_x: [[i32; 3]; 3] = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    let sobel_y: [[i32; 3]; 3] = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    let mut sum = 0i64;
    for y in 1..h - 1 {
        for x in 1..w - 1 {
            let mut gx = 0i32;
            let mut gy = 0i32;
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = pixels[(y + ky - 1) * w + (x + kx - 1)] as i32;
                    gx += px * sobel_x[ky][kx];
                    gy += px * sobel_y[ky][kx];
                }
            }
            sum += (gx * gx + gy * gy) as i64;
        }
    }
    sum as f32 / ((w - 2) * (h - 2)) as f32
}

fn brenner(img: &GrayImage) -> f32 {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let pixels = img.as_raw();

    let mut sum = 0i64;
    for y in 0..h {
        let row = y * w;
        for x in 0..w - 2 {
            let diff = pixels[row + x] as i32 - pixels[row + x + 2] as i32;
            sum += (diff * diff) as i64;
        }
    }
    sum as f32 / (h * (w - 2)) as f32
}
