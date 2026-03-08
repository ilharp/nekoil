use std::path::PathBuf;

use anyhow::Result;
use dotenvy::EnvLoader;

pub struct Config {
    pub db_url: String,
}

pub fn load_config(exe_dir: PathBuf) -> Result<Config> {
    let env_path = match exe_dir.parent().and_then(|p| p.parent()) {
        Some(root) => root.join(".env.local"),
        None => exe_dir.join(".env.local"),
    };
    let env_map = EnvLoader::with_path(env_path).load()?;

    Ok(Config {
        db_url: env_map.var("POSTGRES_URL")?,
    })
}
