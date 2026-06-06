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
  <img src="https://img.shields.io/badge/Version-1.0.4-blue?style=for-the-badge" alt="Version">
</p>
<p align="center">
  <a href="rust/README.md"><img src="https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"></a>
  <a href="go/README.md"><img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go"></a>
  <a href="c/README.md"><img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=white" alt="C"></a>
  <a href="node/README.md"><img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="python/README.md"><img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"></a>
  <a href="cuda/README.md"><img src="https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="CUDA"></a>
  <a href="csharp/README.md"><img src="https://img.shields.io/badge/C%23-.NET-512BD4?style=for-the-badge&logo=dotnet&logoColor=white" alt="C#"></a>
  <a href="zig/README.md"><img src="https://img.shields.io/badge/Zig-F7A41D?style=for-the-badge&logo=zig&logoColor=white" alt="Zig"></a>
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

The **ASP Cascade 16 (D-ASP)** suite is a sovereign post-quantum encryption engine providing bit-perfect interoperability across **Go**, **Rust**, **C**, **Python**, **Node.js**, **CUDA**, **C# (.NET)**, and **Zig**.

---

## 🚀 Performance Profile (Grade-1024)

The suite is instrumented for exhaustive telemetry across all cryptographic and architectural layers.

| Engine        | Total Time   | Casca Time | Casca CPB | Total CPB | Ops/sec      |
| :------------ | :----------- | :--------- | :-------- | :-------- | :----------- |
| **CUDA**      | **200.8 μs** | 201 μs     | **7.28**  | **7.28**  | **4,981.32** |
| **Rust**      | 4.050 ms     | 234 μs     | 8.49      | 146.94    | 4,273.50     |
| **Zig**       | 326.9 μs     | 327 μs     | 11.86     | 11.86     | 3,058.57     |
| **C**         | 2.784 ms     | 553 μs     | 20.06     | 101.02    | 1,808.48     |
| **Python**    | 4.521 ms     | 917 μs     | 33.26     | 164.03    | 1,090.93     |
| **Go**        | 6.141 ms     | 2.244 ms   | 81.44     | 222.84    | 445.57       |
| **Node.js**   | 26.807 ms    | 3.150 ms   | 114.29    | 972.71    | 317.50       |
| **C# (.NET)** | 122.723 ms   | 8.224 ms   | 298.42    | 4453.16   | 121.59       |

> [!NOTE]
> Detailed structural requirements, CLI Usage, High-Throughput Streaming (CUDA) specs, and Known Answer Tests (KAT) are thoroughly documented in the [**Documentation Hub**](#-documentation-hub) above.

---

## 🔬 Cryptographic Proofs & Analysis

The D-ASP suite guarantees mathematical pseudo-randomness and structural immunity against differential, sequence, and side-channel analysis. The output is continuously evaluated via our exhaustive analysis suite against the following optimal cryptographic boundaries using a 100KB payload:

| Metric | Result | Ideal |
| :--- | :--- | :--- |
| **Shannon Entropy (Bits/Byte)** | 7.9977 | ~ 8.000 |
| **Strict Avalanche Criterion (SAC)** | 49.91% | ~ 50.0% |
| **Chi-Square Uniformity** | 323.20 | 200 - 300 |
| **Serial Autocorrelation** | -0.00099 | ~ 0.000 |
| **Monte Carlo Pi Estimation** | 3.14426 | ~ 3.14159 |
| **Monobit Frequency** | 0.5006 | ~ 0.5000 |
| **Runs Test (Decay Ratio)** | 1.0015 | ~ 1.0000 |
| **Cross-Key Diffusion** | 49.98% | ~ 50.0% |
| **Constant-Time Variance** | 0.0000% | < 5.00% |

> [!TIP]
> **NIST SP 800-22 Certification Ready:** D-ASP includes a native bitstream generator (`npm run gen-nist`) that rapidly pipes hardware-accelerated gigabytes of raw ciphertext into binary format, ready for direct ingestion by external tools like `Dieharder` and the official NIST `sts` suite.

---

## 🤝 Cross-Language Implementation Parity

All implementations are designed as **high-performance, standalone sources** to ensure maximum portability and zero external cryptographic dependencies (where possible).

| Language      | Engine Path           | Core Implementation             | Documentation                       |
| :------------ | :-------------------- | :------------------------------ | :---------------------------------- |
| **Rust**      | `rust/src/main.rs`    | ML-KEM / ASP Cascade 16         | [📖 Rust Guide](rust/README.md)     |
| **Go**        | `go/main.go`          | ML-KEM / ASP Cascade 16         | [📖 Go Guide](go/README.md)         |
| **C/C++**     | `c/spna_engine.c`     | FFI ML-KEM / ASP Cascade 16     | [📖 C/C++ Guide](c/README.md)       |
| **Python**    | `python/dasp.py`      | WASM ML-KEM / ASP Cascade 16    | [📖 Python Guide](python/README.md) |
| **Node.js**   | `node/dasp.js`        | WASM ML-KEM / ASP Cascade 16    | [📖 Node.js Guide](node/README.md)  |
| **CUDA**      | `cuda/dasp_kernel.cu` | Native ML-KEM / ASP Cascade GPU | [📖 CUDA Guide](cuda/README.md)     |
| **C# (.NET)** | `csharp/Program.cs`   | AVX2 ML-KEM / ASP Cascade 16    | [📖 C# Guide](csharp/README.md)     |
| **Zig**       | `zig/main.zig`        | SIMD ML-KEM / ASP Cascade 16    | [📖 Zig Guide](zig/README.md)       |

---

## ⚖️ License

D-ASP is a Public Domain work, dedicated under the [**CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**](LICENSE).

---
