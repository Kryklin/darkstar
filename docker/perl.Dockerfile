FROM perl:latest
WORKDIR /app
COPY out-wrappers/perl_wrapper.pl .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "cpanm FFI::Platypus && perl perl_wrapper.pl"
