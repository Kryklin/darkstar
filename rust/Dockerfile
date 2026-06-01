# Build stage
FROM rust:alpine as builder
RUN apk add --no-cache musl-dev
WORKDIR /usr/src/app
COPY . .
RUN cargo build --release --bin d-asp

# Runtime stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /usr/src/app/target/release/d-asp ./darkstar-crypt-rust
ENTRYPOINT ["./darkstar-crypt-rust"]
