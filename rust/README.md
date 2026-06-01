[⬅ Back to Main README](../README.md)

# D-ASP: Rust Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
</p>

## Overview
This is the native Rust implementation and the core reference engine for the **ASP Cascade 16 (D-ASP)** suite. It is built for raw performance, memory safety, and produces both native executables and WASM targets for Python and Node.js.

## Prerequisites
- Rust (Cargo) 1.70+

## Build Instructions
```bash
cargo build --release
```

## Usage
The native Rust executable conforms to the standard D-ASP CLI interface:
```bash
cargo run --release -- encrypt <payload> <pk_hex> [--hwid <hex>] [--telemetry]
cargo run --release -- decrypt <json_payload> <sk_hex> [--hwid <hex>] [--telemetry]
```
