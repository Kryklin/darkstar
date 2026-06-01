<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../public/assets/img/logo-white.png">
    <img src="../../public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: Python Implementation

<img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">

This directory contains the Python implementation of the **ASP Cascade 16** engine, part of the D-ASP protocol suite.

## 🛡️ Status: Interoperability Script

The Python implementation is provided primarily for cross-platform validation, research, and standalone recovery in environments where native binaries are not feasible.

## 🔒 Security Profile

- **KEM**: Grade-1024 (ML-KEM-1024) via WebAssembly module (WASM).
- **Hardening**:
  - Offloads cryptographic processing to the precompiled `dasp_crypto.wasm` engine.
  - Leverages `os.urandom` and standard APIs mapped over WASM linear memory boundaries for secure entropy.
- **Constant-Time Analysis**:
  > [!IMPORTANT]
  > **Full WASM Parity**. To mitigate timing side-channels and memory boundary limits historically found in scripting engines, this module now securely mounts the Rust WASM implementation via `wasmtime`, achieving native constant-time arithmetic properties.

## 🚀 Usage

### Install Dependencies

Requires Python 3.9+.

```bash
pip install -r requirements.txt
```

### Key Generation

```bash
python dasp.py keygen
```

### Encryption

```bash
python dasp.py encrypt "your payload" <PUBLIC_KEY_HEX>
```

### Decryption

```bash
python dasp.py decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

---

## 🏗️ Architecture Alignment

This implementation adheres to the [DASP_CRYPTO_MATH.md](../DASP_CRYPTO_MATH.md) specification, implementing the full 16-round **ASP Cascade** engine to ensure bit-perfect ciphertext parity with Rust, Go, C, and Node.js.

[**&larr; Back to D-ASP Suite**](../README.md) | [**Project Root**](../../README.md)
