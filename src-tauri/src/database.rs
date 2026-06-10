use std::collections::VecDeque;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri_plugin_log::log;
use tokio::sync::{Mutex, OwnedSemaphorePermit, Semaphore};
use tokio_rusqlite_new::Connection;

pub type Param = Box<dyn rusqlite::types::ToSql + Send + Sync>;

#[macro_export]
macro_rules! params {
    ($($val:expr),* $(,)?) => {{
        vec![
            $(
                Box::new($val) as Param,
            )*
        ]
    }};
}

struct IdleConnection {
    conn: Connection,
    since: Instant,
}

pub struct Database {
    idle_pool: Arc<Mutex<VecDeque<IdleConnection>>>,
    semaphore: Arc<Semaphore>,
    db_path: PathBuf,
    #[allow(dead_code)]
    idle_timeout: Duration,
}

pub struct PooledConnection {
    conn: Option<Connection>,
    _permit: OwnedSemaphorePermit,
    idle_pool: Arc<Mutex<VecDeque<IdleConnection>>>,
}

impl Database {
    pub async fn new(db_path: impl AsRef<Path>, max_size: u32) -> Result<Self, String> {
        Self::with_idle_timeout(db_path, max_size, Duration::from_secs(300)).await
    }

    pub async fn with_idle_timeout(
        db_path: impl AsRef<Path>,
        max_size: u32,
        idle_timeout: Duration,
    ) -> Result<Self, String> {
        let db_path = db_path.as_ref().to_path_buf();
        log::info!(
            "database.create: path={} max_size={} idle_timeout_secs={}",
            db_path.display(),
            max_size,
            idle_timeout.as_secs()
        );

        let capacity = max_size as usize;
        let semaphore = Arc::new(Semaphore::new(capacity));
        let idle_pool = Arc::new(Mutex::new(VecDeque::new()));

        let db = Self {
            idle_pool: idle_pool.clone(),
            semaphore,
            db_path,
            idle_timeout,
        };

        {
            let pc = db.acquire().await?;
            let result = pc
                .call(move |c| -> Result<(), rusqlite::Error> {
                    init_schema_inner(c)?;
                    Ok(())
                })
                .await;
            result.map_err(|e| format!("Schema init failed: {}", e))?;
        }

        start_idle_reaper(idle_pool, idle_timeout);

        log::info!("database.create: complete path={}", db.db_path.display());
        Ok(db)
    }

    async fn acquire(&self) -> Result<PooledConnection, String> {
        let permit = self
            .semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| format!("Semaphore: {}", e))?;

        {
            let mut idle = self.idle_pool.lock().await;
            if let Some(idle_conn) = idle.pop_front() {
                return Ok(PooledConnection {
                    conn: Some(idle_conn.conn),
                    _permit: permit,
                    idle_pool: self.idle_pool.clone(),
                });
            }
        }

        let conn = Connection::open(&self.db_path)
            .await
            .map_err(|e| format!("Failed to open connection: {}", e))?;

        Ok(PooledConnection {
            conn: Some(conn),
            _permit: permit,
            idle_pool: self.idle_pool.clone(),
        })
    }

    async fn call<F, R>(&self, f: F) -> Result<R, String>
    where
        R: Send + 'static,
        F: FnOnce(&mut rusqlite::Connection) -> Result<R, rusqlite::Error> + Send + 'static,
    {
        let pc = self.acquire().await?;
        let result = pc
            .call(move |c| -> Result<R, rusqlite::Error> { f(c).map_err(|e| e.into()) })
            .await
            .map_err(|e| format!("DB op failed: {}", e));
        result
    }

    pub async fn execute(&self, sql: &str, params: Vec<Param>) -> Result<usize, String> {
        let sql = sql.to_string();
        self.call(move |conn| conn.execute(&sql, &*params_to_refs(&params)))
            .await
    }

    pub async fn execute_insert(&self, sql: &str, params: Vec<Param>) -> Result<i64, String> {
        let sql = sql.to_string();
        self.call(move |conn| {
            conn.execute(&sql, &*params_to_refs(&params))?;
            Ok(conn.last_insert_rowid())
        })
        .await
    }

    pub async fn execute_batch(&self, sql: &str) -> Result<(), String> {
        let sql = sql.to_string();
        self.call(move |conn| conn.execute_batch(&sql)).await
    }

    pub async fn query_rows<T, F>(
        &self,
        sql: &str,
        params: Vec<Param>,
        mapper: F,
    ) -> Result<Vec<T>, String>
    where
        T: Send + 'static,
        F: Fn(&rusqlite::Row<'_>) -> Result<T, rusqlite::Error> + Send + 'static,
    {
        let sql = sql.to_string();
        self.call(move |conn| {
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(&*params_to_refs(&params), |row| mapper(row))?;
            let mut results = Vec::new();
            for row in rows {
                results.push(row?);
            }
            Ok(results)
        })
        .await
    }

    pub async fn query_row<T, F>(
        &self,
        sql: &str,
        params: Vec<Param>,
        mapper: F,
    ) -> Result<Option<T>, String>
    where
        T: Send + 'static,
        F: Fn(&rusqlite::Row<'_>) -> Result<T, rusqlite::Error> + Send + 'static,
    {
        let sql = sql.to_string();
        self.call(move |conn| {
            let mut stmt = conn.prepare(&sql)?;
            let mut rows = stmt.query_map(&*params_to_refs(&params), |row| mapper(row))?;
            match rows.next() {
                Some(Ok(val)) => Ok(Some(val)),
                Some(Err(e)) => Err(e),
                None => Ok(None),
            }
        })
        .await
    }

    pub async fn with_transaction<R, F>(&self, f: F) -> Result<R, String>
    where
        R: Send + 'static,
        F: FnOnce(&rusqlite::Transaction<'_>) -> Result<R, rusqlite::Error> + Send + 'static,
    {
        self.call(move |conn| {
            let tx = conn.transaction()?;
            let result = f(&tx)?;
            tx.commit()?;
            Ok(result)
        })
        .await
    }
}

impl Deref for PooledConnection {
    type Target = Connection;

    fn deref(&self) -> &Connection {
        self.conn
            .as_ref()
            .expect("PooledConnection already dropped")
    }
}

impl Drop for PooledConnection {
    fn drop(&mut self) {
        if let Some(conn) = self.conn.take() {
            let idle = IdleConnection {
                conn,
                since: Instant::now(),
            };
            let idle_pool = self.idle_pool.clone();
            let lock_result = idle_pool.try_lock();
            if let Ok(mut guard) = lock_result {
                guard.push_back(idle);
            } else {
                drop(lock_result);
                tokio::spawn(async move {
                    let mut guard = idle_pool.lock().await;
                    guard.push_back(idle);
                });
            }
        }
    }
}

fn start_idle_reaper(idle_pool: Arc<Mutex<VecDeque<IdleConnection>>>, idle_timeout: Duration) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            let mut guard = idle_pool.lock().await;
            let now = Instant::now();
            guard.retain(|idle| {
                now.checked_duration_since(idle.since)
                    .unwrap_or(Duration::ZERO)
                    < idle_timeout
            });
        }
    });
}

fn params_to_refs(params: &[Param]) -> Vec<&dyn rusqlite::types::ToSql> {
    params
        .iter()
        .map(|p| p.as_ref() as &dyn rusqlite::types::ToSql)
        .collect()
}

fn init_schema_inner(conn: &mut rusqlite::Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS training_data (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name  TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            is_trained INTEGER NOT NULL DEFAULT 0,
            stars      INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_training_data_created_at
            ON training_data(created_at);
        ",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static DB_MUTEX: Mutex<()> = Mutex::new(());

    fn temp_db_path() -> PathBuf {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("exifpro_db_test_{}", ts));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("test.db")
    }

    fn cleanup(path: &Path) {
        if path.exists() {
            let _ = std::fs::remove_file(path);
            if let Some(parent) = path.parent() {
                let _ = std::fs::remove_dir(parent);
            }
        }
    }

    #[tokio::test]
    async fn test_create_pool_and_schema() {
        let _lock = DB_MUTEX.lock().unwrap();
        let db_path = temp_db_path();
        let db = Database::new(&db_path, 2).await.unwrap();

        let tables: Vec<String> = db
            .query_rows(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
                vec![],
                |row| row.get(0),
            )
            .await
            .unwrap();

        assert_eq!(tables, vec!["training_data"]);
        cleanup(&db_path);
    }

    #[tokio::test]
    async fn test_execute_and_query() {
        let _lock = DB_MUTEX.lock().unwrap();
        let db_path = temp_db_path();
        let db = Database::new(&db_path, 2).await.unwrap();

        db.execute(
            "INSERT INTO training_data (file_name, is_trained, stars) VALUES (?1, ?2, ?3)",
            params!["photo1.jpg", 1, 5],
        )
        .await
        .unwrap();
        db.execute(
            "INSERT INTO training_data (file_name, is_trained, stars) VALUES (?1, ?2, ?3)",
            params!["photo2.jpg", 0, 3],
        )
        .await
        .unwrap();

        let rows = db
            .query_rows(
                "SELECT file_name, stars FROM training_data ORDER BY file_name",
                vec![],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?)),
            )
            .await
            .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].0, "photo1.jpg");
        assert_eq!(rows[1].1, 3);

        let val: Option<i32> = db
            .query_row(
                "SELECT stars FROM training_data WHERE file_name = ?1",
                params!["photo1.jpg"],
                |row| row.get(0),
            )
            .await
            .unwrap();
        assert_eq!(val, Some(5));

        let missing: Option<i32> = db
            .query_row(
                "SELECT stars FROM training_data WHERE file_name = ?1",
                params!["nonexistent.jpg"],
                |row| row.get(0),
            )
            .await
            .unwrap();
        assert!(missing.is_none());

        cleanup(&db_path);
    }

    #[tokio::test]
    async fn test_execute_insert() {
        let _lock = DB_MUTEX.lock().unwrap();
        let db_path = temp_db_path();
        let db = Database::new(&db_path, 2).await.unwrap();

        let id = db
            .execute_insert(
                "INSERT INTO training_data (file_name) VALUES (?1)",
                params!["test.jpg"],
            )
            .await
            .unwrap();
        assert!(id > 0);
        cleanup(&db_path);
    }

    #[tokio::test]
    async fn test_execute_batch() {
        let _lock = DB_MUTEX.lock().unwrap();
        let db_path = temp_db_path();
        let db = Database::new(&db_path, 2).await.unwrap();

        db.execute_batch(
            "INSERT INTO training_data (file_name) VALUES ('k1.jpg');
             INSERT INTO training_data (file_name) VALUES ('k2.jpg');",
        )
        .await
        .unwrap();

        let rows: Vec<String> = db
            .query_rows(
                "SELECT file_name FROM training_data ORDER BY file_name",
                vec![],
                |row| row.get(0),
            )
            .await
            .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0], "k1.jpg");
        cleanup(&db_path);
    }

    #[tokio::test]
    async fn test_transaction_commit() {
        let _lock = DB_MUTEX.lock().unwrap();
        let db_path = temp_db_path();
        let db = Database::new(&db_path, 2).await.unwrap();

        let result: i32 = db
            .with_transaction(|tx| {
                tx.execute(
                    "INSERT INTO training_data (file_name, is_trained) VALUES (?1, ?2)",
                    rusqlite::params!["tx_photo.jpg", 1],
                )?;
                Ok(42i32)
            })
            .await
            .unwrap();
        assert_eq!(result, 42);

        let val: Option<i32> = db
            .query_row(
                "SELECT is_trained FROM training_data WHERE file_name = ?1",
                params!["tx_photo.jpg"],
                |row| row.get(0),
            )
            .await
            .unwrap();
        assert_eq!(val, Some(1));
        cleanup(&db_path);
    }

    #[tokio::test]
    async fn test_transaction_rollback() {
        let _lock = DB_MUTEX.lock().unwrap();
        let db_path = temp_db_path();
        let db = Database::new(&db_path, 2).await.unwrap();

        let err = db
            .with_transaction::<(), _>(|tx| {
                tx.execute(
                    "INSERT INTO training_data (file_name) VALUES (?1)",
                    rusqlite::params!["rollback_photo.jpg"],
                )?;
                Err(rusqlite::Error::InvalidParameterName("oops".into()))
            })
            .await;
        assert!(err.is_err());

        let val: Option<String> = db
            .query_row(
                "SELECT file_name FROM training_data WHERE file_name = ?1",
                params!["rollback_photo.jpg"],
                |row| row.get(0),
            )
            .await
            .unwrap();
        assert!(val.is_none());
        cleanup(&db_path);
    }
}
