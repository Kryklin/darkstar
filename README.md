# Darkstar Security Suite

<p align="center">
  <img src="public/assets/img/logo-white.png" width="400" alt="Darkstar Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/Angular-v21.0.8-dd0031?logo=angular&logoColor=white" alt="Angular">
  <img src="https://img.shields.io/badge/Electron-v38.2.0-blue?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-v1.25.5-00ADD8?logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Rust-2021-000000?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Node.js-v19%2B-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

## Overview

`darkstar` is a defense-grade client-side security enclave designed to safeguard recovery phrases, identities, and sensitive records using post-quantum cryptographic primitives.

At its core, Darkstar utilizes the **D-KASP (Deterministic-KASP)** protocol—a sovereign 16-round structural permutation gauntlet paired with **ML-KEM-1024 (Kyber)** for NIST Level 5 security parity.

---

## 🛡️ Core Security Pillars

- **Quantum Resistance**: Powered by ML-KEM-1024 lattice-based key encapsulation.
- **Hardware Binding**: Cryptographic payloads are bound to host-machine silicon via Electron SafeStorage and machine-unique identifiers.
- **High-Diffusion Obfuscation**: The D-KASP gauntlet ensures bit-perfect interoperability across Rust, Go, Python, and Node.js while providing maximum algebraic complexity.
- **Zero-Knowledge Architecture**: Your master password never leaves the isolated security enclave; data is encrypted/decrypted via a high-performance IPC bridge.

---

## 🚀 Getting Started

### Prerequisites

- Node.js v19+
- Rust (Cargo)
- Go v1.25+

### Installation & Development

```bash
git clone https://github.com/Kryklin/darkstar.git
cd darkstar
npm install
npm run build:rust  # Compile the Rust engine
npm run build:go    # Compile the Go engine
npm start           # Launch the Electron Dashboard
```

---

## 🏗️ Technical Resources

For a deep-dive into the mathematical and system-level specifications, please refer to:

- [**D-KASP Mathematical Specification**](DARKSTAR_ARCHITECTURE.md)
- [**Security & Disclosure Policy**](SECURITY.md)
- [**D-KASP Multi-Language Suite**](d-kasp-512/README.md)

---

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
