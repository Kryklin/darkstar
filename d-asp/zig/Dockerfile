FROM debian:bookworm-slim AS builder
RUN apt-get update && apt-get install -y curl xz-utils && rm -rf /var/lib/apt/lists/*
RUN curl -O https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz \
    && tar -xf zig-linux-x86_64-0.13.0.tar.xz \
    && mv zig-linux-x86_64-0.13.0 /usr/local/zig \
    && ln -s /usr/local/zig/zig /usr/local/bin/zig

WORKDIR /app
COPY zig/ ./zig/
COPY c/ ./c/

WORKDIR /app/zig
RUN zig build -Doptimize=ReleaseFast -p dist

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/zig/dist/bin/d-asp_zig ./d-asp_zig.exe
ENTRYPOINT ["./d-asp_zig.exe"]
