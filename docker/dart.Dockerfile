FROM dart:stable
WORKDIR /app
COPY out-wrappers/dart_wrapper.dart .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "dart dart_wrapper.dart"
