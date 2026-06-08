FROM openjdk:17-alpine
WORKDIR /app
COPY out-wrappers/java_wrapper.java .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "java java_wrapper.java"
