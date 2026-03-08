FROM rust:1.94.0-alpine3.23

WORKDIR /usr/src/nekoil
COPY . .
RUN ["cargo", "build", "--release"]

FROM alpine:3.23.3

WORKDIR /app
COPY --from=0 /usr/src/nekoil/target/release/data-service /app/data-service
