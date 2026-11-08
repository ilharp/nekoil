use std::sync::Arc;

use axum::debug_handler;
use axum::extract::State;
use axum::http::StatusCode;

use crate::AppState;

#[debug_handler]
pub async fn handler_notfound(State(app_state): State<Arc<AppState>>) -> (StatusCode, [u8; 0]) {
    (StatusCode::NOT_FOUND, [])
}
