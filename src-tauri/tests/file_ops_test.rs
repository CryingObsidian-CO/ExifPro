pub mod utils;

use exifpro_lib::file_ops::{create_dirs_if_not_exist, safe_copy, safe_move, scan_directory};
use std::fs;
use std::path::{Path, PathBuf};
use utils::temp_dir::SimpleTempDir;

fn make_test_file(dir: &SimpleTempDir, name: &str, content: &[u8]) -> PathBuf {
    let p = dir.path().join(name);
    fs::write(&p, content).unwrap();
    p
}

fn check_file_content(p: &Path, expect: &str) {
    assert!(p.exists());
    let res = fs::read_to_string(p).unwrap();
    assert_eq!(res, expect);
}

#[test]
fn test_create_dirs_success() {
    let dir = SimpleTempDir::new().unwrap();
    let nested = dir.path().join("nested/deep/path");
    assert!(create_dirs_if_not_exist(&nested).is_ok());
    assert!(nested.exists());
}

#[test]
fn test_create_dirs_existing() {
    let dir = SimpleTempDir::new().unwrap();
    let existing = dir.path().join("existing_dir");
    fs::create_dir_all(&existing).unwrap();
    assert!(create_dirs_if_not_exist(&existing).is_ok());
    assert!(existing.exists());
}

#[test]
fn test_safe_copy_basic() {
    let dir = SimpleTempDir::new().unwrap();
    let src = make_test_file(&dir, "src_file.txt", b"test content");
    let dest = dir.path().join("dest_file.txt");

    assert!(safe_copy(&src, &dest, false).is_ok());
    assert!(src.exists());
    check_file_content(&dest, "test content");
}

#[test]
fn test_safe_copy_overwrite() {
    let dir = SimpleTempDir::new().unwrap();
    let src = make_test_file(&dir, "src_file.txt", b"new content");
    let dest = make_test_file(&dir, "dest_overwrite.txt", b"old content");

    assert!(safe_copy(&src, &dest, true).is_ok());
    assert!(src.exists());
    check_file_content(&dest, "new content");
}

#[test]
fn test_safe_copy_no_overwrite_conflict() {
    let dir = SimpleTempDir::new().unwrap();
    let src = make_test_file(&dir, "src_conflict.txt", b"source");
    let dest = make_test_file(&dir, "dest_conflict.txt", b"existing");

    assert!(safe_copy(&src, &dest, false).is_err());
    assert!(src.exists());
    check_file_content(&dest, "existing");
}

#[test]
fn test_safe_move_basic() {
    let dir = SimpleTempDir::new().unwrap();
    let src = make_test_file(&dir, "move_src.txt", b"move me");
    let dest = dir.path().join("move_dest.txt");

    assert!(safe_move(&src, &dest, false).is_ok());
    assert!(!src.exists());
    check_file_content(&dest, "move me");
}

#[test]
fn test_safe_move_overwrite() {
    let dir = SimpleTempDir::new().unwrap();
    let src = make_test_file(&dir, "move_src2.txt", b"fresh content");
    let dest = make_test_file(&dir, "move_dest2.txt", b"stale content");

    assert!(safe_move(&src, &dest, true).is_ok());
    assert!(!src.exists());
    check_file_content(&dest, "fresh content");
}

#[test]
fn test_safe_move_no_overwrite_conflict() {
    let dir = SimpleTempDir::new().unwrap();
    let src = make_test_file(&dir, "move_conflict_src.txt", b"source");
    let dest = make_test_file(&dir, "move_conflict_dest.txt", b"existing");

    assert!(safe_move(&src, &dest, false).is_err());
    assert!(src.exists());
    check_file_content(&dest, "existing");
}

#[test]
fn test_safe_copy_creates_parent_dirs() {
    let dir = SimpleTempDir::new().unwrap();
    let src = make_test_file(&dir, "parent_src.txt", b"nested dir test");
    let dest = dir.path().join("a/b/c/parent_dest.txt");

    assert!(safe_copy(&src, &dest, false).is_ok());
    assert!(dest.exists() && src.exists());
}
#[test]
fn test_safe_move_creates_parent_dirs() {
    let dir = SimpleTempDir::new().unwrap();
    let src = make_test_file(&dir, "parent_src.txt", b"nested dir test");
    let dest = dir.path().join("a/b/c/parent_dest.txt");

    assert!(safe_move(&src, &dest, false).is_ok());
    assert!(dest.exists() && !src.exists());
}

#[test]
fn test_safe_copy_nonexistent_source() {
    let dir = SimpleTempDir::new().unwrap();
    let src = dir.path().join("does_not_exist.txt");
    let dest = dir.path().join("nowhere.txt");

    assert!(safe_copy(&src, &dest, false).is_err());
}

#[test]
fn test_safe_move_nonexistent_source() {
    let dir = SimpleTempDir::new().unwrap();
    let src = dir.path().join("does_not_exist.txt");
    let dest = dir.path().join("nowhere.txt");

    assert!(safe_move(&src, &dest, false).is_err());
}

#[tokio::test]
async fn test_scan_directory_non_recursive() {
    let dir = SimpleTempDir::new().unwrap();
    fs::write(dir.path().join("a.jpg"), b"img1").unwrap();
    fs::write(dir.path().join("b.png"), b"img2").unwrap();
    fs::write(dir.path().join("readme.txt"), b"text").unwrap();

    let result = scan_directory(dir.path(), false).await;
    assert!(result.is_ok());
    let paths = result.unwrap();
    assert_eq!(paths.len(), 2, "should find 2 image files only");
    assert!(paths.iter().any(|p| p.ends_with("a.jpg")));
    assert!(paths.iter().any(|p| p.ends_with("b.png")));
}

#[tokio::test]
async fn test_scan_directory_recursive() {
    let dir = SimpleTempDir::new().unwrap();
    let sub = dir.path().join("sub");
    fs::create_dir_all(&sub).unwrap();
    fs::write(dir.path().join("root.jpg"), b"root").unwrap();
    fs::write(sub.join("deep.jpeg"), b"deep").unwrap();
    fs::write(sub.join("note.txt"), b"skip").unwrap();

    let result = scan_directory(dir.path(), true).await;
    assert!(result.is_ok());
    let paths = result.unwrap();
    assert_eq!(paths.len(), 2, "recursive mode should find 2 image files");
    assert!(paths.iter().any(|p| p.ends_with("root.jpg")));
    assert!(paths.iter().any(|p| p.ends_with("deep.jpeg")));
}

#[tokio::test]
async fn test_scan_directory_empty() {
    let dir = SimpleTempDir::new().unwrap();
    let result = scan_directory(dir.path(), false).await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());
}

#[tokio::test]
async fn test_scan_directory_nonexistent() {
    let result = scan_directory(Path::new("C:\\ definitely_not_exists_xyz"), false).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_scan_directory_recursive_all_image_types() {
    let dir = SimpleTempDir::new().unwrap();
    for ext in &["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp"] {
        fs::write(dir.path().join(format!("img.{}", ext)), b"img").unwrap();
    }
    for ext in &[
        "arw", "cr2", "dng", "nef", "raf", "rw2", "orf", "heic", "heif",
    ] {
        fs::write(dir.path().join(format!("raw.{}", ext)), b"raw").unwrap();
    }
    fs::write(dir.path().join("doc.pdf"), b"doc").unwrap();

    let result = scan_directory(dir.path(), false).await;
    assert!(result.is_ok());
    let paths = result.unwrap();
    assert_eq!(paths.len(), 17, "should find 17 supported image files");
}
