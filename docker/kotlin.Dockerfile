FROM zenika/kotlin
WORKDIR /app
COPY out-wrappers/kotlin_wrapper.kt .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "kotlinc kotlin_wrapper.kt -include-runtime -d kotlin_wrapper.jar && java -jar kotlin_wrapper.jar"
