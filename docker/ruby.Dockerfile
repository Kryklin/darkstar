FROM ruby:3.2-alpine
WORKDIR /app
COPY out-wrappers/ruby_wrapper.rb .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "apk add --no-cache build-base && gem install ffi && ruby ruby_wrapper.rb"
