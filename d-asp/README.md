<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../public/assets/img/logo-white.png">
    <img src="../public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: Multi-Language Cryptographic Engine Suite

<p align="left">
  <img src="https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=white" alt="C">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
</p>

[**&larr; Back to Project Root**](../README.md) | [**Mathematical Specification**](DASP_CRYPTO_MATH.md) | [**System Logic Flows**](DASP_SYSTEM_FLOW.md)

The **ASP Cascade 16 (D-ASP)** suite is a sovereign post-quantum encryption engine providing bit-perfect interoperability across **Go**, **Rust**, **C**, **Python**, and **Node.js**.

---

## 🛠️ Core Capabilities

- **ML-KEM-1024 (Kyber)**: Grade-1024 High-Security root of trust.
- **16-Round ASP Cascade 16 Engine**: Hardened deterministic schedule (Substitution, Permutation, Network, Algebraic) every round.
- **HMAC-Linked Fusion**: Authentication-first protocol providing ML-KEM-linked integrity.
- **Hardware Binding**: Optional machine-unique entropy injection ($HWID$).

## 🚀 Performance Profile (Grade-1024)

The suite is instrumented for exhaustive telemetry across all cryptographic and architectural layers.

### System Telemetry
- **CPU**: Intel Core i7-based (6 Phys / 12 Log Cores) @ 2.60 GHz
- **Cache**: 1.5MB L2 / 12MB L3
- **Storage**: SSD-backed (High-speed IO)
- **Security Standards**: Fully compliant with Grade-1024 structural requirements.

| Engine | Mean (ms) | Cascd (μs) | Cascd CPB | Total CPB | Ops/sec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Go** | 14.19 | 62 | 5000.9 | 1.15M | 70.48 |
| **Rust** | 14.36 | 33 | 2656.9 | 1.16M | 69.64 |
| **C**    | 15.08 | 132 | 10725.0 | 1.22M | 66.29 |
| **Node.js** | 139.15 | 1715 | 139.3k | 11.3M | 7.19 |
| **Python** | 198.71 | 7622 | 619.3k | 16.1M | 5.03 |

> [!NOTE]
> **Cycles per Byte (CPB)** is calculated for the 32-byte (256-bit) internal state. Native engines (Go, Rust, C) achieve elite CPB efficiency by leveraging structural optimizations.

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
| **Python**  | `python/darkstar_crypt.py` | ASP Cascade 16          | **Branchless-Equivalent**|
| **Node.js** | `node/darkstar_crypt.js`   | ASP Cascade 16 / Bridge | **Branchless-Equivalent**|

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
