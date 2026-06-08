FROM golang:1.20-alpine
WORKDIR /app
COPY out-wrappers/go_wrapper.go .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "apk add --no-cache gcc musl-dev && go run go_wrapper.go"
