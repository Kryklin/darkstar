FROM node:18-alpine
WORKDIR /app
COPY out-wrappers/node_wrapper.js .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "node node_wrapper.js"
