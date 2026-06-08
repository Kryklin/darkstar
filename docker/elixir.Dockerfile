FROM elixir:alpine
WORKDIR /app
COPY out-wrappers/elixir_wrapper.ex .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "elixir elixir_wrapper.ex"
