<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-white.png">
    <img src="assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: Multi-Language Cryptographic Engine Suite

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge" alt="Version">
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=white" alt="C">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="CUDA">
  <img src="https://img.shields.io/badge/C%23-.NET-512BD4?style=for-the-badge&logo=dotnet&logoColor=white" alt="C#">
  <img src="https://img.shields.io/badge/Zig-F7A41D?style=for-the-badge&logo=zig&logoColor=white" alt="Zig">
</p>

> [!IMPORTANT]
> **Notice**: The UI/Electron application (Darkstar Vault) has been decoupled and moved to its own repository at `darkstar-vault`. This repository is now exclusively dedicated to the standalone `d-asp` backend cryptographic engines.

## 📚 Documentation Hub

Explore the architecture and specifications of the D-ASP suite:

| Specification | Description |
| :--- | :--- |
| [**Mathematical Specification**](DASP_CRYPTO_MATH.md) | Cryptographic proofs, ML-KEM constants, and bounds. |
| [**System Logic Flows**](DASP_SYSTEM_FLOW.md) | Sequence diagrams and execution cascades. |
| [**NIST Compliance**](DASP_NIST_COMPLIANCE.md) | Grade-1024 SP 800-208 / FIPS 203 alignment matrix. |
| [**CLI Guide**](DARKSTAR_CLI_GUIDE.md) | Usage instructions for universal CLI integration. |
| [**Security Policy**](SECURITY.md) | Vulnerability disclosure and audit policies. |
| [**Contributing**](CONTRIBUTING.md) | Guidelines for engine optimization and PR submission. |

The **ASP Cascade 16 (D-ASP)** suite is a sovereign post-quantum encryption engine providing bit-perfect interoperability across **Go**, **Rust**, **C**, **Python**, **Node.js**, **CUDA**, **C# (.NET)**, and **Zig**.

---

## 🚀 Performance Profile (Grade-1024)

The suite is instrumented for exhaustive telemetry across all cryptographic and architectural layers.

| Engine        | Total Time   | Casca Time | Casca CPB | Total CPB | Ops/sec   |
| :------------ | :----------- | :--------- | :-------- | :-------- | :-------- |
| **Zig**       | **12.54 ms** | 0 μs       | 0.00      | 1.02M     | **79.74** |
| **Rust**      | 14.22 ms     | 6.25 μs    | 507.81    | 1.16M     | 70.31     |
| **Go**        | 14.67 ms     | 0 μs       | 0.00      | 1.19M     | 68.17     |
| **C**         | 14.44 ms     | 111 μs     | 9010.62   | 1.17M     | 69.27     |
| **Node.js**   | 100.94 ms    | 0 μs       | 0.00      | 8.20M     | 9.91      |
| **CUDA**      | 139.08 ms    | 139 μs     | 11310.00  | 11.30M    | 7.19      |
| **C# (.NET)** | 151.43 ms    | 0 μs       | 0.00      | 12.30M    | 6.60      |
| **Python**    | 363.38 ms    | 0 μs       | 0.00      | 29.52M    | 2.75      |

> [!NOTE]
> Detailed structural requirements, CLI Usage, High-Throughput Streaming (CUDA) specs, and Known Answer Tests (KAT) are thoroughly documented in the [**Documentation Hub**](#-documentation-hub) above.

## 🏗️ Cross-Language Implementation Parity

All implementations are designed as **high-performance, standalone sources** to ensure maximum portability and zero external cryptographic dependencies (where possible).

| Language | Engine Path | Core Implementation | Documentation |
| :--- | :--- | :--- | :--- |
| **Rust** | `rust/src/main.rs` | ML-KEM / ASP Cascade 16 | [📖 Rust Guide](rust/README.md) |
| **Go** | `go/main.go` | ML-KEM / ASP Cascade 16 | [📖 Go Guide](go/README.md) |
| **C/C++** | `c/spna_engine.c` | FFI ML-KEM / ASP Cascade 16 | [📖 C/C++ Guide](c/README.md) |
| **Python** | `python/dasp.py` | WASM ML-KEM / ASP Cascade 16 | [📖 Python Guide](python/README.md) |
| **Node.js** | `node/dasp.js` | WASM ML-KEM / ASP Cascade 16 | [📖 Node.js Guide](node/README.md) |
| **CUDA** | `cuda/dasp_kernel.cu` | Native ML-KEM / ASP Cascade GPU | [📖 CUDA Guide](cuda/README.md) |
| **C# (.NET)** | `csharp/Program.cs` | AVX2 ML-KEM / ASP Cascade 16 | [📖 C# Guide](csharp/README.md) |
| **Zig** | `zig/main.zig` | SIMD ML-KEM / ASP Cascade 16 | [📖 Zig Guide](zig/README.md) |

---

## ⚖️ License

D-ASP is a Public Domain work, dedicated under the [**CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**](LICENSE).
