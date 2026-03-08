use std::path::PathBuf;

use anyhow::Result;
use dotenvy::EnvLoader;
use dotenvy::EnvSequence;

pub struct Config {
    pub db_url: String,
}

pub fn load_config(exe_dir: PathBuf) -> Result<Config> {
    let env_path = match exe_dir.parent().and_then(|p| p.parent()) {
        Some(root) => root.join(".env.local"),
        None => exe_dir.join(".env.local"),
    };

    let env_map = match EnvLoader::with_path(env_path).load() {
        Ok(env_map) => env_map,
        Err(dotenvy::Error::Io(_, _)) => EnvLoader::new().sequence(EnvSequence::EnvOnly).load()?,
        err => err?,
    };

    Ok(Config {
        db_url: env_map.var("POSTGRES_URL")?,
    })
}
