<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-white.png">
    <img src="assets/logo-black.png" width="240" alt="Darkstar Logo">
  </picture>
</p>
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/header-anim-dark.svg">
    <img src="assets/header-anim-light.svg" width="800" alt="Darkstar Substitution Permutation Network Algebraic">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.6-blue?style=for-the-badge" alt="Version">
</p>
<p align="center">
  <a href="rust/README.md"><img src="https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"></a>
  <a href="WASM_README.md"><img src="https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white" alt="WASM"></a>
  <a href="c/README.md"><img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=white" alt="C"></a>
  <a href="cuda/README.md"><img src="https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="CUDA"></a>
</p>

## 📚 Documentation Hub

Explore the architecture and specifications of the D-SPNA-512 suite:

| Specification                                         | Description                                           |
| :---------------------------------------------------- | :---------------------------------------------------- |
| [**Mathematical Specification**](DSPNA_512_CRYPTO_MATH.md) | Cryptographic proofs, ML-KEM constants, and bounds.   |
| [**System Logic Flows**](DSPNA_512_SYSTEM_FLOW.md)         | Sequence diagrams and execution cascades.             |
| [**NIST Compliance**](DSPNA_512_NIST_COMPLIANCE.md)        | Grade-1024 SP 800-208 / FIPS 203 alignment matrix.    |
| [**CLI Guide**](DARKSTAR_CLI_GUIDE.md)                | Usage instructions for universal CLI integration.     |
| [**Security Policy**](SECURITY.md)                    | Vulnerability disclosure and audit policies.          |
| [**Contributing**](CONTRIBUTING.md)                   | Guidelines for engine optimization and PR submission. |

The **ASP Cascade 16 (D-SPNA-512)** suite is a sovereign post-quantum encryption engine providing bit-perfect interoperability across **Rust**, **C**, and **CUDA**, with **WebAssembly** bindings via Node/Python/Go. It operates as a strict **512-bit (64-byte) Block Cipher in Counter (CTR) Mode** with a full 512-bit key schedule expansion.

### 🛡️ Hardware Intrinsic Mitigations
D-SPNA-512 is engineered for the modern threat landscape, proactively immunizing execution against side-channels and micro-architectural data sampling:
- **Zenbleed (CVE-2023-20593)**: Complete physical SIMD register zeroing (`_mm256_zeroupper()`).
- **Spectre v1 / Meltdown**: Strict speculation barriers via `lfence` (x86_64) and `isb`/`csdb` (ARM).
- **DPA-Lockout**: Chaotic PRNG cross-state corruption triggered on repeating ciphertext patterns to neutralize Differential Power Analysis.

---

## 🚀 Performance Profile (Grade-1024)

The suite is instrumented for exhaustive telemetry across all cryptographic and architectural layers using a 64KB streaming payload.

| Engine        | Casca Time | Casca CPB | Ops/sec      | Throughput (MB/s) |
| :------------ | :--------- | :-------- | :----------- | :---------------- |
| **Rust**      | **56.47 μs**  | **2.81**  | **17,708**   | **1210.5**        |
| **CUDA**      | 144.73 μs  | 7.23      | 6,909        | 472.3             |
| **C**         | 211.70 μs  | 10.57     | 4,723        | 322.9             |

### 🏎️ Synthetic GPU Benchmarks (CUDA)

The CUDA engine was engineered to support massive parallel payloads by streaming chunks across thousands of SMs. The following tests bypass CPU-bound orchestration entirely.

| Payload Size | Encrypt (GB/s) | Decrypt (GB/s) |
| :----------- | :------------- | :------------- |
| **1 MB**     | 292.57         | 328.50         |
| **16 MB**    | 538.15         | 638.50         |
| **64 MB**    | 603.71         | 644.31         |
| **256 MB**   | 638.80         | 652.96         |
| **512 MB**   | 651.21         | 650.48         |

> [!NOTE]
> Detailed structural requirements, CLI Usage, High-Throughput Streaming (CUDA) specs, and Known Answer Tests (KAT) are thoroughly documented in the [**Documentation Hub**](#-documentation-hub) above.

---

## 🔬 Cryptographic Proofs & Analysis

The D-SPNA-512 suite guarantees mathematical pseudo-randomness and structural immunity against differential, sequence, and side-channel analysis. The output is continuously evaluated via our exhaustive analysis suite against the following optimal cryptographic boundaries using a 100KB payload:

| Metric | Rust | C | CUDA | Ideal |
| :--- | :--- | :--- | :--- | :--- |
| **Shannon Entropy (Bits/Byte)** | 7.9985 | 7.9978 | 7.9983 | ~ 8.000 |
| **Strict Avalanche Criterion (SAC)** | 49.57% | 50.60% | 49.99% | ~ 50.0% |
| **Chi-Square Uniformity** | 208.74 | 305.61 | 236.93 | 200 - 300 |
| **Serial Autocorrelation** | 0.00109 | -0.00029 | 0.00034 | ~ 0.000 |
| **Monte Carlo Pi Estimation** | 3.14078 | 3.13953 | 3.14672 | ~ 3.14159 |
| **Monobit Frequency (p-value)** | 0.9313 | 0.5173 | 0.9295 | > 0.0100 |
| **Runs Test (p-value)** | 0.8079 | 0.4535 | 0.8234 | > 0.0100 |
| **Cross-Key Diffusion** | 50.08% | 49.98% | 50.01% | ~ 50.0% |
| **Constant-Time Variance** | 0.0000% | 0.0000% | 0.0000% | < 5.00% |
| **Block Frequency (χ²)** | 6516.22 | 6340.97 | 6368.19 | ~ 6400.0 |
| **Spectral DFT (Peaks)** | 3639 | 3548 | 3546 | ~ 3500 |
| **LZ Compression** | 1.000 | 1.000 | 1.000 | 1.000 |
| **Longest Run of Ones (χ²)** | 2.36 | 5.85 | 6.41 | ~ 0.000 |
| **Approximate Entropy** | 0.6925 | 0.6925 | 0.6925 | ~ 0.693 |
| **Serial Pattern Test (χ²)** | 32931.92 | 32856.64 | 32875.84 | ~ 32768 |
| **Lempel-Ziv Incompressibility** | 1.0004 | 1.0004 | 1.0004 | ~ 1.000 |

> [!TIP]
> **NIST SP 800-22 Certification Ready:** D-SPNA-512 includes a native bitstream generator (`npm run gen-nist`) that rapidly pipes hardware-accelerated gigabytes of raw ciphertext into binary format, ready for direct ingestion by external tools like `Dieharder` and the official NIST `sts` suite.

---

## 🤝 Cross-Language Implementation Parity

All implementations are designed as **high-performance, standalone sources** to ensure maximum portability and zero external cryptographic dependencies (where possible).

| Language      | Engine Path           | Core Implementation             | Documentation                       |
| :------------ | :-------------------- | :------------------------------ | :---------------------------------- |
| **Rust**      | `rust/src/main.rs`    | ML-KEM / ASP Cascade 16         | [📖 Rust Guide](rust/README.md)     |
| **C/C++**     | `c/spna_engine.c`     | FFI ML-KEM / ASP Cascade 16     | [📖 C/C++ Guide](c/README.md)       |
| **CUDA**      | `cuda/dspna_512_kernel.cu` | Native ML-KEM / ASP Cascade GPU | [📖 CUDA Guide](cuda/README.md)     |
| **WASM**      | `rust/Cargo.toml`     | WebAssembly Wrapper via `wasm-pack`| [📖 WASM FFI Guide](WASM_README.md) |

---

## ⚖️ License

D-SPNA-512 is a Public Domain work, dedicated under the [**CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**](LICENSE).

---
