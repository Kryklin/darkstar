<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-white.png">
    <img src="assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# Darkstar ARX Substitution Permutation

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge" alt="Version">
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

| Engine        | Total Time   | Casca Time | Casca CPB | Total CPB | Ops/sec   |
| :------------ | :----------- | :--------- | :-------- | :-------- | :-------- |
| **C**         | **11.48 ms** | 260 μs     | 9.43      | 416.46    | **87.10** |
| **Zig**       | 13.51 ms     | 185 μs     | 6.72      | 490.07    | 74.01     |
| **Go**        | 15.01 ms     | 849 μs     | 30.80     | 544.60    | 66.60     |
| **Rust**      | 16.16 ms     | 118 μs     | **4.27**  | 586.06    | 61.89     |
| **Node.js**   | 109.15 ms    | 1.39 ms    | 50.34     | 3959.07   | 9.16      |
| **C# (.NET)** | 140.51 ms    | 4.35 ms    | 157.63    | 5096.58   | 7.12      |
| **CUDA**      | 266.03 ms    | 170 μs     | 6.15      | 9649.41   | 3.76      |
| **Python**    | 286.30 ms    | 534 μs     | 19.38     | 10384.80  | 3.49      |

> [!NOTE]
> Detailed structural requirements, CLI Usage, High-Throughput Streaming (CUDA) specs, and Known Answer Tests (KAT) are thoroughly documented in the [**Documentation Hub**](#-documentation-hub) above.

## 🏗️ Cross-Language Implementation Parity

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

<div align="center">

[🏠 Main](README.md) | [📐 Math Spec](DASP_CRYPTO_MATH.md) | [⚙️ System Flows](DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](DARKSTAR_CLI_GUIDE.md) | [🔒 Security](SECURITY.md) | [🤝 Contributing](CONTRIBUTING.md)

</div>
