<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../public/assets/img/logo-white.png">
    <img src="../../public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: Node.js / Javascript Implementation

<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">

This directory contains the Node.js (ESM) implementation of the **ASP Cascade 16** engine, part of the D-ASP protocol suite.

## 🛡️ Status: Production Bridge

The Node.js implementation acts as the primary bridge for web applications and Electron-based host environments ($Darkstar$).

## 🔒 Security Profile

- **KEM**: Grade-1024 (ML-KEM-1024) via WebAssembly module (WASM).
- **Hardening**:
  - Offloads cryptographic processing to the precompiled `dasp_crypto.wasm` engine.
  - Leverages Node.js `crypto.randomFillSync` and standard APIs mapped over WASM linear memory boundaries for secure entropy.
- **Constant-Time Analysis**:
  > [!IMPORTANT]
  > **Full WASM Parity**. To mitigate timing side-channels and memory boundary limits historically found in JS engines, this module now securely mounts the Rust WASM implementation, achieving native constant-time arithmetic properties.

## 🚀 Usage

### Install Dependencies

```bash
npm install
```

### Key Generation

```bash
node dasp.js keygen
```

### Encryption

```bash
node dasp.js encrypt "your payload" <PUBLIC_KEY_HEX>
```

### Decryption

```bash
node dasp.js decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

---

## 🏗️ Architecture Alignment

This implementation strictly follows the [DASP_CRYPTO_MATH.md](../DASP_CRYPTO_MATH.md) specification. It utilizes the same 16-round **ASP Cascade** engine and MDS matrix constants as the reference.

[**&larr; Back to D-ASP Suite**](../README.md) | [**Project Root**](../../README.md)
