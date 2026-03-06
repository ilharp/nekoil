use std::process::ExitCode;

use anyhow::Result;
use tracing::error;

fn main() -> ExitCode {
    tracing_subscriber::fmt::init();

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(main_async())
}

async fn main_async() -> ExitCode {
    match main_async_intl().await {
        Ok(_) => ExitCode::SUCCESS,
        Err(err) => {
            error!("{err:?}");
            ExitCode::FAILURE
        }
    }
}

async fn main_async_intl() -> Result<()> {
    anyhow::Ok(())
}
