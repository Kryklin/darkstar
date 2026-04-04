# Build stage
FROM rust:1.75-alpine as builder
RUN apk add --no-cache musl-dev
WORKDIR /usr/src/app
COPY . .
RUN cargo build --release

# Runtime stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /usr/src/app/target/release/darkstar-crypt-rust ./darkstar-crypt-rust
ENTRYPOINT ["./darkstar-crypt-rust"]
