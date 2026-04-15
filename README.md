<p align="right">
  <img src="public/assets/img/logo-white.png" width="120" alt="Darkstar Logo">
</p>

# Darkstar Security Suite

<p align="center">
  <img src="public/assets/img/logo-white.png" width="400" alt="Darkstar Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Security-Grade--1024-black?style=for-the-badge&logo=shield" alt="Security Grade">
  <img src="https://img.shields.io/badge/Interoperability-Verified-success?style=for-the-badge&logo=checkmarx" alt="Interoperability">
  <img src="https://img.shields.io/badge/Version-3.0.0-blue?style=for-the-badge" alt="Version">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Rust-v3.0.0-black?style=for-the-badge&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/Go-v3.0.0-00ADD8?style=for-the-badge&logo=go" alt="Go">
  <img src="https://img.shields.io/badge/Node.js-v3.0.0-339933?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Python-v3.0.0-3776AB?style=for-the-badge&logo=python" alt="Python">
</p>

## Overview

`darkstar` is a defense-grade client-side security enclave designed to safeguard recovery phrases, identities, and sensitive records using post-quantum cryptographic primitives.

At its core, Darkstar utilizes the **D-ASP (Darkstar Algebraic Substitution & Permutation)** protocol—a sovereign 16-round structural permutation gauntlet paired with **ML-KEM-1024 (Kyber)** for Grade-1024 security parity.

---

## 🛡️ Core Security Pillars

- **Quantum Resistance**: Powered by ML-KEM-1024 lattice-based key encapsulation.
- **Hardware Binding**: Cryptographic payloads are bound to host-machine silicon via Electron SafeStorage and machine-unique identifiers.
- **High-Diffusion Obfuscation**: The D-ASP gauntlet ensures bit-perfect interoperability across Rust, Go, Python, and Node.js while providing maximum algebraic complexity.
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

- [**D-ASP Mathematical Specification**](DARKSTAR_ARCHITECTURE.md)
- [**Security & Disclosure Policy**](SECURITY.md)
- [**D-ASP Multi-Language Suite**](d-asp/README.md)

---

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
