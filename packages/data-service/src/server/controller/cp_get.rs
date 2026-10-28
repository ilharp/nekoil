use std::sync::Arc;

use axum::debug_handler;
use axum::extract::State;
use entity::cp_handle_deleted_v1;
use entity::cp_v1;
use sea_orm::EntityTrait;
use sea_orm::raw_sql;
use serde::Deserialize;

use crate::AppState;
use crate::server::ApiJson;
use crate::server::AppError;
use crate::server::ErrorResponseBody;
use crate::server::ResponseBody;

#[derive(Deserialize)]
pub struct Request {
    #[serde(rename = "queryHandle")]
    query_handle: String,
    #[serde(rename = "isPlusHandle")]
    is_plus_handle: bool,
}

#[derive(serde::Serialize)]
#[serde(untagged)]
pub enum Response {
    Data(ResponseBody<cp_v1::Model>),
    Error(ErrorResponseBody),
}

#[debug_handler]
pub async fn controller_cp_get(
    State(app_state): State<Arc<AppState>>,
    body: ApiJson<Request>,
) -> anyhow::Result<ApiJson<Response>, AppError> {
    let ApiJson(request) = body;

    let query_handle = request.query_handle;
    let handle_types: Vec<i16> = if request.is_plus_handle {
        vec![1, 4]
    } else {
        vec![2, 3]
    };

    let result: Vec<cp_v1::Model> = cp_v1::Entity::find()
        .from_raw_sql(raw_sql!(
            Postgres,
            r#"
SELECT "cp_v1".*
FROM "cp_v1"
WHERE "cp_v1"."deleted" = 0
AND "cp_v1"."cpid" IN (
SELECT "cp_handle_v1"."cpid"
FROM "cp_handle_v1"
WHERE "cp_handle_v1"."deleted" = 0
AND "cp_handle_v1"."handle" = {query_handle}
AND "cp_handle_v1"."handle_type" IN ({..handle_types})
)
    "#
        ))
        .all(&app_state.db)
        .await?;

    if result.len() != 1 {
        let tombstone: Vec<cp_handle_deleted_v1::Model> = cp_handle_deleted_v1::Entity::find()
            .from_raw_sql(raw_sql!(
                Postgres,
                r#"
SELECT "cp_handle_deleted_v1".*
FROM "cp_handle_deleted_v1"
WHERE "cp_handle_deleted_v1"."handle" = {query_handle}
AND "cp_handle_deleted_v1"."handle_type" IN ({..handle_types})
ORDER BY "cp_handle_deleted_v1"."deleted_time" DESC
LIMIT 1
    "#
            ))
            .all(&app_state.db)
            .await?;

        if let Some(tombstone) = tombstone.first() {
            let code = match tombstone.deleted_reason {
                1 => 3003,
                3 => 3004,
                _ => 3002,
            };

            return Ok(ApiJson(Response::Error(ErrorResponseBody {
                code,
                msg: "EXXXXX CP DELETED".to_owned(),
            })));
        }

        return Ok(ApiJson(Response::Error(ErrorResponseBody {
            code: 3001,
            msg: "EXXXXX NOT FOUND".to_owned(),
        })));
    }

    Ok(ApiJson(Response::Data(ResponseBody::new(
        result.into_iter().next().unwrap(),
    ))))
}
