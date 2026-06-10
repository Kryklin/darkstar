# WebAssembly (WASM) Implementation

The D-SPNA-512 engine can be securely compiled into WebAssembly for execution directly within the browser, bringing military-grade quantum resistance to web clients.

## Security Considerations for Web
- **No SIMD Wipes**: WASM currently does not expose physical register zeroing or speculative pipeline flushes (`isb`/`lfence`). Hardware-level Spectre and Zenbleed mitigations are dependent on the underlying browser sandbox.
- **Constant Time**: The ARX cascade remains constant-time, preventing standard timing side-channels.

## Build
Compile the Rust engine to WASM using `wasm-pack`:
`wasm-pack build --target web`
