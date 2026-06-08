FROM php:8.2-cli-alpine
WORKDIR /app
COPY out-wrappers/php_wrapper.php .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "php php_wrapper.php"
