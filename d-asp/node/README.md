<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../public/assets/img/logo-white.png">
    <img src="../../public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: Node.js / Javascript Implementation

<img src="https://img.shields.io/badge/Node.js-v3.0.0-339933?style=for-the-badge&logo=node.js" alt="Node.js">

This directory contains the Node.js (ESM) implementation of the Darkstar Algebraic Substitution & Permutation (D-ASP) protocol.

## 🛡️ Status: Production Bridge

The Node.js implementation acts as the primary bridge for web applications and Electron-based host environments. It is designed for maximum interoperability with the Rust reference.

## 🔒 Security Profile

- **KEM**: Grade-1024 (ML-KEM-1024) via [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum).
- **Hardening**:
  - Leverages Node.js `crypto` module for high-entropy PBKDF2 and SHA-256 operations.
  - Implements `timingSafeEqual` for MAC verification.
- **Constant-Time Analysis**:
  > [!IMPORTANT]
  > **Branchless-Equivalent**. To mitigate timing side-channels, this implementation utilizes branchless arithmetic masking for all $GF(2^8)$ field operations. However, due to the nature of the V8 JavaScript engine (JIT, GC), absolute constant-time execution cannot be guaranteed on the same level as the hardware-bound Rust reference.

## 🚀 Usage

### Install Dependencies
```bash
npm install
```

### Key Generation
```bash
node darkstar_crypt.js keygen
```

### Encryption
```bash
node darkstar_crypt.js encrypt "your payload" <PUBLIC_KEY_HEX>
```

### Decryption
```bash
node darkstar_crypt.js decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

---

## 🏗️ Architecture Alignment
This implementation strictly follows the [DASP_CRYPTO_MATH.md](../DASP_CRYPTO_MATH.md) specification. It utilizes identical AES S-Box and MDS matrix constants to ensure bit-perfect cross-platform recovery.

[**&larr; Back to D-ASP Suite**](../README.md) | [**Project Root**](../../README.md)
