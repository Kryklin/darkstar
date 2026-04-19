<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" width="400" alt="Darkstar Logo">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Submitted-success?style=for-the-badge" alt="Status Submitted">
  <a href="d-asp/README.md"><img src="https://img.shields.io/badge/Interoperability-Verified-success?style=for-the-badge&logo=checkmarx" alt="Interoperability"></a>
  <img src="https://img.shields.io/badge/Version-3.0.0-blue?style=for-the-badge" alt="Version">
</p>

# Darkstar Security Suite
### *The Sovereign Post-Quantum Enclave for Identity & Asset Recovery.*

Darkstar is a defense-grade client-side security enclave. It provides a hardened, air-gapped-ready environment for safeguarding recovery phrases, cryptographic identities, and sensitive records using next-generation post-quantum primitives.

---

## 🏗️ System Architecture

At its core, Darkstar utilizes the **ASP Cascade 16** protocol—a sovereign 16-round structural permutation engine paired with **ML-KEM-1024 (Kyber)** for Grade-1024 security parity.

> [!TIP]
> **Detailed Architectural Deep-Dive**: For a comprehensive visual breakdown of logic flows, hardware binding ($HUB$), and the **ASP Cascade 16** engine, see the [**DASP System Flow Documentation**](d-asp/DASP_SYSTEM_FLOW.md).

> [!NOTE]
> **Grade-1024 Compliance**: Every byte processed by Darkstar undergoes a 16-round algebraic transformation (ASP Cascade 16), providing maximum resistance to standard and differential cryptanalysis.

---

## 🛡️ The Multi-Engine Matrix

**ASP Cascade 16**: The 16-round engine ensures bit-perfect interoperability across Rust, Go, Python, and Node.js while providing maximum algebraic complexity.

| Engine | optimization | implementation | Security Tier | Interop |
| :--- | :--- | :--- | :--- | :--- |
| **Rust** | **Native (LTO)** | Reference implementation | Grade-1024 | `PASSED` |
| **Go** | **Native (SSA)** | High-performance bridge | Grade-1024 | `PASSED` |
| **Node.js** | **Managed** | Production Bridge (Electron) | Grade-1024 | `PASSED` |
| **Python** | **Managed** | Research & Validation | Grade-1024 | `PASSED` |

---

## 🚀 Quick Start

Ensure you have the required runtimes (Node 19+, Rust 1.75+, Go 1.25+).

```bash
# 1. Clone the Sovereign Repository
git clone https://github.com/Kryklin/darkstar.git && cd darkstar

# 2. Deploy Local Enclave Dependencies
npm install

# 3. Synchronize Cryptographic Engines
npm run build:rust  # Reference Native
npm run build:go    # Performance Native

# 4. Initialize Dashboard
npm start
```

---

## 🏗️ Technical Resources

| Resource | Scope | Link |
| :--- | :--- | :--- |
| **D-ASP Specification** | Formal Math & Logic | [**DASP_CRYPTO_MATH.md**](d-asp/DASP_CRYPTO_MATH.md) |
| **Multi-Language Docs** | Integration & Usage | [**D-ASP Suite**](d-asp/README.md) |
| **Security Policy** | Disclosure & Auditing | [**SECURITY.md**](SECURITY.md) |
| **Contribution Guide** | Standards & Workflows | [**CONTRIBUTING.md**](CONTRIBUTING.md) |

---

## ⚖️ License

Darkstar is a Public Domain work, dedicated under the [**CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**](LICENSE). We prioritize freedom of audit and the right to sovereign encryption.
