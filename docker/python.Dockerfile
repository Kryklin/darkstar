FROM python:3.11-alpine
WORKDIR /app
COPY out-wrappers/python_wrapper.py .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "python python_wrapper.py"
