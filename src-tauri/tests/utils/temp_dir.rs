use std::path::{Path, PathBuf};
use std::time::SystemTime;
use std::{env, fs, io};

pub struct SimpleTempDir(PathBuf);

impl SimpleTempDir {
    pub fn new() -> io::Result<Self> {
        let base = env::temp_dir();
        // 时间戳+随机串生成唯一目录名
        let ts = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir_path = base.join(format!("rust_test_tmp_{}", ts));
        fs::create_dir_all(&dir_path)?;
        Ok(Self(dir_path))
    }

    pub fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for SimpleTempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
