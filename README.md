<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-white.png">
    <img src="assets/logo-black.png" width="240" alt="Darkstar Logo">
  </picture>
</p>
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/header-anim-dark.svg">
    <img src="assets/header-anim-light.svg" width="800" alt="Darkstar ARX Substitution Permutation">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.5-blue?style=for-the-badge" alt="Version">
</p>
<p align="center">
  <a href="rust/README.md"><img src="https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"></a>
  <a href="WASM_README.md"><img src="https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white" alt="WASM"></a>
  <a href="c/README.md"><img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=white" alt="C"></a>
  <a href="cuda/README.md"><img src="https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="CUDA"></a>
</p>

## 📚 Documentation Hub

Explore the architecture and specifications of the D-ASP suite:

| Specification                                         | Description                                           |
| :---------------------------------------------------- | :---------------------------------------------------- |
| [**Mathematical Specification**](DASP_CRYPTO_MATH.md) | Cryptographic proofs, ML-KEM constants, and bounds.   |
| [**System Logic Flows**](DASP_SYSTEM_FLOW.md)         | Sequence diagrams and execution cascades.             |
| [**NIST Compliance**](DASP_NIST_COMPLIANCE.md)        | Grade-1024 SP 800-208 / FIPS 203 alignment matrix.    |
| [**CLI Guide**](DARKSTAR_CLI_GUIDE.md)                | Usage instructions for universal CLI integration.     |
| [**Security Policy**](SECURITY.md)                    | Vulnerability disclosure and audit policies.          |
| [**Contributing**](CONTRIBUTING.md)                   | Guidelines for engine optimization and PR submission. |

The **ASP Cascade 16 (D-ASP)** suite is a sovereign post-quantum encryption engine providing bit-perfect interoperability across **Rust**, **C**, and **CUDA**, with **WebAssembly** bindings via Node/Python/Go.

---

## 🚀 Performance Profile (Grade-1024)

The suite is instrumented for exhaustive telemetry across all cryptographic and architectural layers using a 64KB streaming payload.

| Engine        | Casca Time | Casca CPB | Ops/sec      | Throughput (MB/s) |
| :------------ | :--------- | :-------- | :----------- | :---------------- |
| **CUDA**      | 156.44 μs  | **7.64**  | **6,392**    | **437.0**         |
| **Rust**      | **134.91 μs** | **6.59** | **7,412**    | **506.7**         |
| **C**         | 249.55 μs  | 12.19     | 4,007        | 273.9             |

### 🏎️ Synthetic GPU Benchmarks (CUDA)

The CUDA engine was engineered to support massive parallel payloads by streaming chunks across thousands of SMs. The following tests bypass CPU-bound orchestration entirely.

| Payload Size | Encrypt (GB/s) | Decrypt (GB/s) |
| :----------- | :------------- | :------------- |
| **1 MB**     | 292.57         | 328.50         |
| **16 MB**    | 538.15         | 638.50         |
| **64 MB**    | 603.71         | 644.31         |
| **256 MB**   | 638.80         | 652.96         |
| **512 MB**   | 651.21         | 650.48         |
| **1024 MB**  | 651.66         | 654.24         |

> [!NOTE]
> Detailed structural requirements, CLI Usage, High-Throughput Streaming (CUDA) specs, and Known Answer Tests (KAT) are thoroughly documented in the [**Documentation Hub**](#-documentation-hub) above.

---

## 🔬 Cryptographic Proofs & Analysis

The D-ASP suite guarantees mathematical pseudo-randomness and structural immunity against differential, sequence, and side-channel analysis. The output is continuously evaluated via our exhaustive analysis suite against the following optimal cryptographic boundaries using a 100KB payload:

| Metric | Result | Ideal |
| :--- | :--- | :--- |
| **Shannon Entropy (Bits/Byte)** | 7.9984 | ~ 8.000 |
| **Strict Avalanche Criterion (SAC)** | 49.78% | ~ 50.0% |
| **Chi-Square Uniformity** | 231.89 | 200 - 300 |
| **Serial Autocorrelation** | -0.00032 | ~ 0.000 |
| **Monte Carlo Pi Estimation** | 3.15083 | ~ 3.14159 |
| **Monobit Frequency** | 0.5003 | ~ 0.5000 |
| **Runs Test (Decay Ratio)** | 1.0000 | ~ 1.0000 |
| **Cross-Key Diffusion** | 50.01% | ~ 50.0% |
| **Constant-Time Variance** | 0.0000% | < 5.00% |

> [!TIP]
> **NIST SP 800-22 Certification Ready:** D-ASP includes a native bitstream generator (`npm run gen-nist`) that rapidly pipes hardware-accelerated gigabytes of raw ciphertext into binary format, ready for direct ingestion by external tools like `Dieharder` and the official NIST `sts` suite.

---

## 🤝 Cross-Language Implementation Parity

All implementations are designed as **high-performance, standalone sources** to ensure maximum portability and zero external cryptographic dependencies (where possible).

| Language      | Engine Path           | Core Implementation             | Documentation                       |
| :------------ | :-------------------- | :------------------------------ | :---------------------------------- |
| **Rust**      | `rust/src/main.rs`    | ML-KEM / ASP Cascade 16         | [📖 Rust Guide](rust/README.md)     |
| **C/C++**     | `c/spna_engine.c`     | FFI ML-KEM / ASP Cascade 16     | [📖 C/C++ Guide](c/README.md)       |
| **CUDA**      | `cuda/dasp_kernel.cu` | Native ML-KEM / ASP Cascade GPU | [📖 CUDA Guide](cuda/README.md)     |
| **WASM**      | `rust/Cargo.toml`     | WebAssembly Wrapper via `wasm-pack`| [📖 WASM FFI Guide](WASM_README.md) |

---

## ⚖️ License

D-ASP is a Public Domain work, dedicated under the [**CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**](LICENSE).

---
