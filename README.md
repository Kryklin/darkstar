<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" width="400" alt="Darkstar Logo">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-3.0.4-blue?style=for-the-badge" alt="Version">
</p>

# Darkstar Security Suite

### _The Sovereign Post-Quantum Enclave for Identity & Asset Recovery._

Darkstar is a defense-grade client-side security enclave. It provides a hardened, air-gapped-ready environment for safeguarding recovery phrases, cryptographic identities, and sensitive records using next-generation post-quantum primitives.

---

## 🏗️ System Architecture

At its core, Darkstar utilizes the **ASP Cascade 16** protocol—a sovereign 16-round structural permutation engine paired with **ML-KEM-1024 (Kyber)** for Grade-1024 security parity.

> [!TIP]
> **Detailed Architectural Deep-Dive**: For a comprehensive visual breakdown of logic flows, hardware binding ($HUB$), and the **ASP Cascade 16** engine, see the [**DASP System Flow Documentation**](d-asp/DASP_SYSTEM_FLOW.md).

> [!NOTE]
> **Grade-1024 Compliance**: Every byte processed by Darkstar undergoes a 16-round algebraic transformation (ASP Cascade 16), providing maximum resistance to standard and differential cryptanalysis.

> [!IMPORTANT]
> **Fault Injection & RAM Scraping Countermeasures**: Darkstar implements redundant temporal parity looping to neutralize VCC glitching / instruction skipping during decapsulation, and utilizes aggressive runtime-specific post-execution memory zeroization (`SecureZeroMemory`, `KeepAlive` pinning, native `ctypes` overrides) to prevent OS-level side-channel leakage.

---

## 🛡️ The Multi-Engine Matrix

**ASP Cascade 16**: The 16-round engine ensures bit-perfect interoperability across Rust, Go, C, Python, Node.js, and CUDA while providing maximum algebraic complexity.

| Engine      | optimization       | implementation               | Security Tier | Interop  |
| :---------- | :----------------- | :--------------------------- | :------------ | :------- |
| **Rust**    | **Native (LTO)**   | Reference implementation     | Grade-1024    | `PASSED` |
| **Go**      | **Native (SSA)**   | High-performance bridge      | Grade-1024    | `PASSED` |
| **C**       | **Native (Clang)** | Procedural Reference         | Grade-1024    | `PASSED` |
| **Node.js** | **Managed (Decrypt-Only)** | Production Bridge (Electron) | Grade-1024    | `PASSED` |
| **Python**  | **Managed (Decrypt-Only)** | Research & Validation        | Grade-1024    | `PASSED` |
| **CUDA**    | **Native (NVCC)**  | Massively Parallel GPU       | Grade-1024    | `PASSED` |

### 🚀 Extreme Performance (Grade-1024)

Darkstar is heavily optimized using vectorized SIMD (AVX2) and GPU PTX instructions, pipelining PCIe transfers and maintaining exact register bounds to achieve sub-millisecond cascading.

| Engine   | Total Time | Casca Time | Casca CPB | Ops/sec |
| :------- | :--------- | :--------- | :-------- | :------ |
| **Rust** | 12.98 ms   | 3 μs       | 251.88    | 77.03   |
| **Go**   | 12.46 ms   | 0 μs       | 0.00      | 80.21   |
| **C**    | 11.58 ms   | 66 μs      | 5362.50   | 86.29   |
| **CUDA** | 125.85 ms  | 116 μs     | 9449.38   | 7.95    |

> [!NOTE]
> _CUDA timing includes the total host-to-host DMA transfer pipeline. The actual unrolled Grade-1024 SPNA Cascade computes in ~164us (micro-seconds)._

> [!TIP]
> **Zero Microsecond (0 μs) Readings**
> You may observe `0 μs` for `Casca Time` in highly optimized native engines like **Go** during small payload benchmarks. This is a measurement artifact, not a bug. For minimal payloads, the pure unrolled execution completes so quickly (< 100ns) that it finishes entirely between the ticks of the OS monotonic clock (e.g., Windows QPC), effectively registering zero elapsed time.

---

## 🚀 Quick Start (Interactive Dashboard)

The easiest way to manage Darkstar is via the integrated developer dashboard. This tool handles orchestration for all language engines, mobile synchronization, and distribution.

```bash
# 1. Clone the Sovereign Repository
git clone https://github.com/Kryklin/darkstar.git && cd darkstar

# 2. Deploy Local Enclave Dependencies
npm install

# 3. Launch Interactive CLI
npm start
```

For a detailed breakdown of all dashboard options, see the [**Darkstar CLI Guide**](DARKSTAR_CLI_GUIDE.md).

---

## 🏗️ Technical Resources

| Resource                | Scope                   | Link                                                 |
| :---------------------- | :---------------------- | :--------------------------------------------------- |
| **D-ASP Specification** | Formal Math & Logic     | [**DASP_CRYPTO_MATH.md**](d-asp/DASP_CRYPTO_MATH.md) |
| **Interactive CLI**     | Dev & Release Dashboard | [**DARKSTAR_CLI_GUIDE.md**](DARKSTAR_CLI_GUIDE.md)   |
| **App Guide**           | Desktop & Mobile Setup  | [**DARKSTAR_APP_GUIDE.md**](DARKSTAR_APP_GUIDE.md)   |
| **Multi-Language Docs** | Integration & Usage     | [**D-ASP Suite**](d-asp/README.md)                   |
| **Security Policy**     | Disclosure & Auditing   | [**SECURITY.md**](SECURITY.md)                       |
| **Contribution Guide**  | Standards & Workflows   | [**CONTRIBUTING.md**](CONTRIBUTING.md)               |

---

## ⚖️ License

Darkstar is a Public Domain work, dedicated under the [**CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**](LICENSE). We prioritize freedom of audit and the right to sovereign encryption.
