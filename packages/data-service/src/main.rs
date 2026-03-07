use std::env::current_exe;
use std::process::ExitCode;
use std::sync::Arc;

use anyhow::Context;
use anyhow::Result;
use axum::Router;
use axum::routing::post;
use sea_orm::Database;
use sea_orm::DatabaseConnection;
use tap::Tap;
use tokio::select;
use tokio::spawn;
use tokio::sync::Notify;
use tokio_util::sync::CancellationToken;
use tracing::debug;
use tracing::error;
use tracing::info;

use crate::config::Config;
use crate::config::load_config;
use crate::server::controller::cp_get::controller_cp_get;
use crate::server::controller::notfound::handler_notfound;

mod config;
mod server;

fn main() -> ExitCode {
    unsafe { std::env::set_var("RUST_LOG", "debug") };

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_test_writer()
        .init();

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
    let shutdown_notify = Arc::new(Notify::const_new());

    let exe_path = current_exe().context("Failed to get current exe path")?;
    debug!("Executable: {}", exe_path.display());

    let exe_dir = exe_path.clone().tap_mut(|x| {
        x.pop();
    });
    debug!("Executable dir: {}", exe_dir.display());

    let config = load_config(exe_dir)?;

    let app_state = AppState::new(config, &shutdown_notify).await?;

    let app = Router::new()
        .route("/v1/cp.get", post(controller_cp_get))
        .fallback(handler_notfound)
        .with_state(app_state.clone());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:5143")
        .await
        .context("Failed to bind tcp port")?;

    // Write daemon.lock only after port bound

    // Start Server
    let app_state = app_state.clone();
    let shutdown_token = CancellationToken::new();
    let server_shutdown_token = shutdown_token.clone();

    spawn(async move {
        let result = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                server_shutdown_token.cancelled().await;
            })
            .await;

        if let Err(err) = result {
            error!("{err}");
            app_state.shutdown();
        }
    });

    // Graceful shutdown on main thread
    graceful_shutdown(shutdown_notify, shutdown_token).await;

    anyhow::Ok(())
}

struct AppState {
    config: Config,

    shutdown_notify: Arc<Notify>,

    db: DatabaseConnection,
}

impl AppState {
    async fn new(config: Config, shutdown_notify: &Arc<Notify>) -> Result<Arc<AppState>> {
        let db = Database::connect(config.db_url.clone()).await?;

        anyhow::Ok(Arc::new_cyclic(|app_state| AppState {
            config,
            shutdown_notify: shutdown_notify.clone(),
            db,
        }))
    }

    fn shutdown(&self) {
        self.shutdown_notify.notify_one();
    }
}

async fn graceful_shutdown(shutdown_notify: Arc<Notify>, shutdown_token: CancellationToken) {
    // 1. Wait for shutdown signals
    let signal = shutdown_signal_received(shutdown_notify).await;

    info!("{} signal received, starting to shutdown", signal);

    // 2. Tell all components to shutdown
    shutdown_token.cancel();
}

async fn shutdown_signal_received(shutdown_notify: Arc<Notify>) -> &'static str {
    #[cfg(target_os = "windows")]
    select! {
        // Some signals do not work on Windows 7.
        // Fill Err arm with std::future::pending.
        //
        // SIGQUIT
        _ = async {
            match tokio::signal::windows::ctrl_break() {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "SIGQUIT",
        // SIGINT
        _ = async {
            match tokio::signal::windows::ctrl_c() {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "SIGINT",
        // SIGTERM, "the normal way to politely ask a program to terminate"
        _ = async {
            match tokio::signal::windows::ctrl_close() {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "SIGTERM",
        _ = async {
            match tokio::signal::windows::ctrl_logoff() {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "Logoff",
        _ = async {
            match tokio::signal::windows::ctrl_shutdown() {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "Shutdown",
        _ = shutdown_notify.notified() => "Shutdown",
    }

    #[cfg(not(target_os = "windows"))]
    select! {
        // SIGTERM, "the normal way to politely ask a program to terminate"
        _ = async {
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "SIGTERM",
        // SIGINT, Ctrl-C
        _ = async {
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt()) {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "SIGINT",
        // SIGQUIT, Ctrl-\
        _ = async {
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::quit()) {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "SIGQUIT",
        // SIGHUP, Terminal disconnected. SIGHUP also needs gracefully terminating
        _ = async {
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::hangup()) {
                Ok(mut signal) => signal.recv().await,
                Err(_) => std::future::pending().await,
            }
        } => "SIGHUP",
        _ = shutdown_notify.notified() => "Shutdown",
    }
}
