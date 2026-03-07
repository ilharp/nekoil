use std::sync::Arc;

use axum::debug_handler;
use axum::extract::State;
use serde::{Deserialize, Serialize};

use crate::server::ApiJson;
use crate::{AppError, AppState};

#[derive(Deserialize)]
pub struct Request {}

#[derive(Serialize)]
pub struct Response {}

#[debug_handler]
pub async fn controller_cp_get(
    State(app_state): State<Arc<AppState>>,
    body: ApiJson<Request>,
) -> anyhow::Result<ApiJson<Response>, AppError> {
    Ok(ApiJson(Response {}))
}
