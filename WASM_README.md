# D-ASP Language Wrapper & Integration Guide

<p align="center">
  <img src="https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white" alt="WASM">
  <img src="https://img.shields.io/badge/C--FFI-000000?style=for-the-badge&logo=c&logoColor=white" alt="C-FFI">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Ruby-CC342D?style=flat-square&logo=ruby&logoColor=white" alt="Ruby">
  <img src="https://img.shields.io/badge/Elixir-4B275F?style=flat-square&logo=elixir&logoColor=white" alt="Elixir">
  <img src="https://img.shields.io/badge/PHP-777BB4?style=flat-square&logo=php&logoColor=white" alt="PHP">
  <img src="https://img.shields.io/badge/C%23-239120?style=flat-square&logo=c-sharp&logoColor=white" alt="C#">
  <br>
  <img src="https://img.shields.io/badge/Java-ED8B00?style=flat-square&logo=openjdk&logoColor=white" alt="Java">
  <img src="https://img.shields.io/badge/Kotlin-7F52FF?style=flat-square&logo=kotlin&logoColor=white" alt="Kotlin">
  <img src="https://img.shields.io/badge/Dart-0175C2?style=flat-square&logo=dart&logoColor=white" alt="Dart">
  <img src="https://img.shields.io/badge/Swift-F05138?style=flat-square&logo=swift&logoColor=white" alt="Swift">
  <img src="https://img.shields.io/badge/Lua-2C2D72?style=flat-square&logo=lua&logoColor=white" alt="Lua">
  <img src="https://img.shields.io/badge/R-276DC3?style=flat-square&logo=r&logoColor=white" alt="R">
  <img src="https://img.shields.io/badge/Julia-9558B2?style=flat-square&logo=julia&logoColor=white" alt="Julia">
  <img src="https://img.shields.io/badge/Perl-39457E?style=flat-square&logo=perl&logoColor=white" alt="Perl">
</p>

This guide details how to integrate the Darkstar cryptographic engine into any target language ecosystem using the **CLI Language Wrapper Scaffolder**.

## The Scaffolding Tool

The CLI includes an automated scaffolding tool (`npm start` -> `Generate Language Wrapper`) that instantly generates boilerplate and functional library loading code. 

Instead of writing complex WebAssembly (WASM) or C-FFI pointer management code manually, the tool generates native source files (e.g., `.js`, `.py`, `.go`, `.rb`, `.java`) tailored specifically to the language and backend you choose. It automatically copies the compiled engine binary into your project and injects the initialization code.

## Supported Architectures & Languages

The scaffolder supports two core backends for integration. When you select a language, the tool will generate the exact code needed to invoke the native cryptographic functions.

### 1. WebAssembly (WASM) Backend
Best for memory-managed scripting languages and web environments. The Rust engine is compiled to `wasm32-unknown-unknown` and executed securely via a WASM runtime.

The tool generates functional WASM loading code for:
- **Node.js**: Native `WebAssembly` object
- **Browser JS**: Native `fetch` & `WebAssembly.instantiateStreaming`
- **Python**: `wasmtime` module
- **Go**: `wazero` package
- **Ruby**: `wasmtime` gem
- **Elixir**: `wasmex` integration
- **PHP**: `wasmer/wasmer-php`
- **C# / .NET**: `Wasmtime` NuGet package

### 2. C-FFI (Foreign Function Interface) Backend
Best for high-performance compiled languages or systems without mature WASM engines. This bypasses the WASM sandbox and binds directly to the high-performance `dasp_kem.dll` (or `.so`/`.dylib`) compiled by the C engine.

The tool generates functional FFI pointer mappings for:
- **Java**: `JNA`
- **Kotlin**: `JNA`
- **Dart**: `dart:ffi`
- **Swift**: Native C-Interop / `dlopen`
- **Lua**: LuaJIT `ffi`
- **R**: `dyn.load()` / `.Call()`
- **Julia**: `ccall`
- **Perl**: `FFI::Platypus`
- **Ruby**: `ffi` gem
- **Python**: `ctypes`
- **Node.js**: `ffi-napi`
- **Go**: `CGO`
- **C#**: `DllImport`

---

## WASM Specific Concepts

When integrating via the WebAssembly backend, there are several architectural constraints you must be aware of:

### Custom Entropy Injection
WebAssembly has no native OS access, meaning it cannot call `/dev/urandom`. To generate cryptographic nonces and ephemeral keys, we expose an import function:
```rust
extern "C" {
    fn host_getrandom(ptr: *mut u8, len: usize);
}
```
The generated scaffold code will explicitly note where the host environment (e.g., Python, Node, Go) **MUST** inject `host_getrandom` into the WASM import object, piping secure system entropy (`crypto.randomFillSync`, `os.urandom`, etc.) directly into the WASM linear memory pointer.

### Memory Management
WASM linear memory is shared between the host and the WASM runtime. To securely pass data (like payloads or keys) into the WASM module without copying overhead, use the explicit allocation FFI exported by the module:

1. **`wasm_alloc(size)`**: Tells the WASM allocator to reserve `size` bytes. The host writes directly to this pointer.
2. **`wasm_dealloc(ptr, size)`**: Tells the allocator to free the memory. **Crucial for avoiding memory leaks** in long-running processes.

### Security Considerations

> [!WARNING]  
> **Memory Zeroization**: Although the Rust backend uses the `zeroize` crate to wipe sensitive keys from memory immediately after execution, the WASM linear memory buffer itself cannot be protected by the OS (no page/memory protection). Do not run sensitive cryptography in multi-tenant browser tabs via WASM without Strict SharedArrayBuffer isolation.
