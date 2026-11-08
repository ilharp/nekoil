use std::sync::Arc;

use anyhow::Context;
use anyhow::Result;
use headers::ContentType;
use headers::HeaderMapExt;
use http::HeaderMap;
use serde::Deserialize;
use tap::Tap;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobBuilder;
use tokio_cron_scheduler::JobScheduler;
use tracing::error;
use tracing::info;
use tracing::instrument;
use tracing::warn;
use uuid::Uuid;

use crate::AppState;

pub fn cleanup_niassets(app_state: Arc<AppState>) -> Job {
    JobBuilder::new()
        .with_timezone(chrono_tz::Asia::Shanghai)
        .with_cron_job_type()
        .with_schedule("0 4 * * *")
        .unwrap()
        .with_run_async(Box::new(move |uuid, l| {
            let app_state = app_state.clone();

            Box::pin(async move { run(uuid, l, app_state).await })
        }))
        .build()
        .unwrap()
}

#[instrument(name = "cleanup_niassets", skip_all)]
async fn run(uuid: Uuid, l: JobScheduler, app_state: Arc<AppState>) {
    match run_intl(uuid, l, app_state).await {
        Ok(_) => (),
        Err(err) => {
            error!("{err:?}");
        }
    }
}

#[derive(Deserialize)]
struct CleanupResponseBody {
    code: u16,
    data: Option<CleanupResponseData>,
}

#[derive(Deserialize)]
struct CleanupResponseData {
    scanned: Option<u64>,
    removed: Option<u64>,
    failed: Option<Vec<u64>>,
}

async fn run_intl(uuid: Uuid, mut l: JobScheduler, app_state: Arc<AppState>) -> Result<()> {
    let url = format!(
        "{}/nekoil/v0/internal/niassets.cleanup",
        app_state.config.core_url,
    );

    let response = app_state
        .http
        .post(&url)
        .header(
            "nekoil-internal-token",
            app_state.config.internal_token.as_str(),
        )
        .headers(HeaderMap::new().tap_mut(|x| x.typed_insert(ContentType::json())))
        .body("{}")
        .send()
        .await
        .with_context(|| format!("Failed to request core: {url}"))?;

    let status = response.status();
    let body_text = response
        .text()
        .await
        .context("Failed to read cleanup response body")?;

    if !status.is_success() {
        anyhow::bail!("core responded with http {status}: {body_text}");
    }

    let body: CleanupResponseBody = serde_json::from_str(&body_text)
        .with_context(|| format!("Failed to parse response: {body_text}"))?;

    if body.code != 200 {
        anyhow::bail!("core responded with code {}: {body_text}", body.code);
    }

    let (scanned, removed, failed) = body.data.map_or((0, 0, Vec::new()), |x| {
        (
            x.scanned.unwrap_or(0),
            x.removed.unwrap_or(0),
            x.failed.unwrap_or_default(),
        )
    });

    info!(
        "core cleanup: scanned {scanned}, removed {removed}, failed {}",
        failed.len()
    );

    if !failed.is_empty() {
        warn!("core cleanup failed niaids: {failed:?}");
    }

    let next_tick = l.next_tick_for_job(uuid).await.unwrap();
    info!("Next time cleanup_niassets is {:?}", next_tick);

    anyhow::Ok(())
}
