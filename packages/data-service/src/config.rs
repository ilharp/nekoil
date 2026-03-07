use std::path::PathBuf;

use anyhow::Result;
use dotenvy::EnvLoader;

pub struct Config {
    pub db_url: String,
}

pub fn load_config(exe_dir: PathBuf) -> Result<Config> {
    let env_map = EnvLoader::with_path(
        exe_dir
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join(".env.local"),
    )
    .load()?;

    Ok(Config {
        db_url: env_map.var("POSTGRES_URL")?,
    })
}
