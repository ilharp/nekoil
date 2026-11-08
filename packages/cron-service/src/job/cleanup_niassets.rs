use std::sync::Arc;

use anyhow::Result;
use headers::ContentType;
use headers::HeaderMapExt;
use http::HeaderMap;
use tap::Tap;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobBuilder;
use tokio_cron_scheduler::JobScheduler;
use tracing::error;
use tracing::info;
use tracing::instrument;
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

async fn run_intl(uuid: Uuid, mut l: JobScheduler, app_state: Arc<AppState>) -> Result<()> {
    reqwest::Client::new()
        .post("")
        .headers(HeaderMap::new().tap_mut(|x| x.typed_insert(ContentType::json())))
        .body("{}")
        .send()
        .await?;
    let next_tick = l.next_tick_for_job(uuid).await.unwrap();
    info!("Next time cleanup_niassets is {:?}", next_tick);

    anyhow::Ok(())
}
