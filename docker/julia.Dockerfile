FROM julia:alpine
WORKDIR /app
COPY out-wrappers/julia_wrapper.jl .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "julia julia_wrapper.jl"
