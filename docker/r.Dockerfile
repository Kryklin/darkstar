FROM r-base
WORKDIR /app
COPY out-wrappers/r_wrapper.R .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "Rscript r_wrapper.R"
