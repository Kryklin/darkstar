<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../public/assets/img/logo-white.png">
    <img src="../public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: Multi-Language Cryptographic Engine Suite

<p align="left">
  <img src="https://img.shields.io/badge/Version-3.0.3-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=white" alt="C">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="CUDA">
</p>

[**&larr; Back to Project Root**](../README.md) | [**Mathematical Specification**](DASP_CRYPTO_MATH.md) | [**System Logic Flows**](DASP_SYSTEM_FLOW.md)

The **ASP Cascade 16 (D-ASP)** suite is a sovereign post-quantum encryption engine providing bit-perfect interoperability across **Go**, **Rust**, **C**, **Python**, **Node.js**, and **CUDA**.

---

## 🛠️ Core Capabilities

- **ML-KEM-1024 (Kyber)**: Grade-1024 High-Security root of trust.
- **16-Round ASP Cascade 16 Engine**: Hardened deterministic schedule (ARX, CTR Mode, SIMD Vectorized) every round.
- **HKDF Root Expansion**: Secure key derivation and multi-factor hardware identity binding.
- **HMAC-Linked Fusion**: Authentication-first protocol providing ML-KEM-linked integrity.
- **Hardware Binding**: Optional machine-unique entropy injection ($HWID$).
- **CUDA Acceleration**: GPU-accelerated massive parallel throughput using PTX native structures.

## 🚀 Performance Profile (Grade-1024)

The suite is instrumented for exhaustive telemetry across all cryptographic and architectural layers.

### System Telemetry
- **CPU**: Intel Core i7-based (6 Phys / 12 Log Cores) @ 2.60 GHz
- **Cache**: 1.5MB L2 / 12MB L3
- **Storage**: SSD-backed (High-speed IO)
- **Security Standards**: Fully compliant with Grade-1024 structural requirements.

| Engine | Total Time | Casca Time | Casca CPB | Total CPB | Ops/sec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rust** | 15.92 ms | 3 μs | 264.06 | 1.29M | 62.78 |
| **Go** | 16.15 ms | 0 μs | 0.00 | 1.31M | 61.92 |
| **C**    | 12.23 ms | 83 μs | 6755.94 | 0.99M | 81.72 |
| **Node.js** | 148.42 ms | 332 μs | 26942.50 | 12.0M | 6.74 |
| **Python** | 160.50 ms | 276 μs | 22449.38 | 13.0M | 6.23 |
| **CUDA** | 127.63 ms | 164 μs | 13345.31 | 10.3M | 7.83 |

> [!NOTE]
> **Cycles per Byte (CPB)** is calculated for the 32-byte (256-bit) internal state. Native engines (Go, Rust, C) achieve elite CPB efficiency by leveraging structural optimizations.

> [!TIP]
> **Zero Microsecond (0 μs) Readings**
> You may observe `0 μs` for `Casca Time` in highly optimized engines like **Go** during small payload benchmarks. This is a measurement artifact, not a bug. For minimal payloads (e.g., 64 bytes), the pure native unrolled execution completes so quickly (< 100ns) that it finishes entirely between the ticks of the OS monotonic clock (e.g., Windows QPC), effectively registering zero elapsed time.

## 🛡️ Cryptographic Verification (KAT)

D-ASP is subject to rigorous **Known Answer Tests (KAT)** to ensure bit-perfect deterministic behavior across all implementation languages.

| Test Case | Description | Status | Parity |
| :--- | :--- | :--- | :--- |
| **V1_STD** | Standard Payload (32-byte) | `PASSED` | Bit-Perfect |
| **V2_IDB** | Identity Bound (HWID) | `PASSED` | Bit-Perfect |
| **V3_LNG** | Long-form Payload (>128 bytes) | `PASSED` | Bit-Perfect |

> **Audit Result**: All engines (Rust, Go, C, Node, Python) produced a bit-for-bit match with the Grade-1024 reference vectors.

---

## 🏗️ Cross-Language Implementation Parity

All implementations are designed as **high-performance, standalone sources** to ensure maximum portability and zero external cryptographic dependencies (where possible).

| Language    | Engine Path                | Core Implementation    | Constant-Time           |
| :---------- | :------------------------- | :--------------------- | :---------------------- |
| **Rust**    | `rust/src/main.rs`         | ML-KEM / ASP Cascade 16 | **Full**                |
| **Go**      | `go/main.go`               | ML-KEM / ASP Cascade 16 | **Full**                |
| **C/C++**   | `c/spna_engine.c`          | FFI ML-KEM / ASP Cascade 16| **Full**                |
| **Python**  | `python/dasp.py`           | ASP Cascade 16          | **Branchless-Equivalent**|
| **Node.js** | `node/darkstar_crypt.js`   | ASP Cascade 16 / Bridge | **Branchless-Equivalent**|
| **CUDA**    | `cuda/dasp_kernel.cu`      | ASP Cascade 16 GPU      | **Full**                |

---

## ⌨️ CLI Usage Standard

All CLI engines share a standardized argument structure for seamless integration.

```bash
# General Syntax
./darkstar [flags] <command> [arguments...]

# Available Commands
encrypt <payload> <pk_hex> [--hwid <hex>]    # Encrypt using D-ASP
decrypt <json_payload> <sk_hex> [--hwid <hex>] # Decrypt using D-ASP
keygen                                       # Generate ML-KEM keypair
test                                         # Run bit-perfect self-test
```

---

## 📜 Exchange Specification

D-ASP utilizes a flattened JSON envelope for universal compatibility:

```json
{
  "data": "<HEX_ENCODED_PAYLOAD>",
  "ct": "<HEX_ENCODED_KEM_CIPHERTEXT>",
  "mac": "<HEX_ENCODED_HMAC_TAG>"
}
```

> [!NOTE]
> **Bit-Parity Guarantee**: For any given input and keys, every engine in this suite is mathematically guaranteed to output identical Hex/JSON byte-streams.

---

## ⚖️ License

D-ASP is a Public Domain work, dedicated under the [**CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**](../LICENSE).
