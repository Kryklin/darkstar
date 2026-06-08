FROM frolvlad/alpine-luajit
WORKDIR /app
COPY out-wrappers/lua_wrapper.lua .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "luajit lua_wrapper.lua"
