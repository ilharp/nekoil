FROM rust:1.94.0-alpine3.23

WORKDIR /usr/src/nekoil
COPY . .
RUN ["apk", "add", "--no-cache", "openssl-dev"]
RUN RUSTFLAGS="-C target-feature=-crt-static" cargo build --release --target x86_64-unknown-linux-musl

FROM alpine:3.23.3

WORKDIR /app
RUN ["apk", "add", "--no-cache", "openssl-dev"]
COPY --from=0 /usr/src/nekoil/target/release/data-service /app/data-service
