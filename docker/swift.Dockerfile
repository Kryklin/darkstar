FROM swift:5.8
WORKDIR /app
COPY out-wrappers/swift_wrapper.swift .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "swift swift_wrapper.swift"
