# D-ASP: Multi-Language Cryptographic Engine Suite

The **D-ASP (Darkstar Algebraic Substitution & Permutation)** suite is a sovereign post-quantum encryption engine providing bit-perfect interoperability across **Go**, **Rust**, **Python**, and **Node.js**.

---

## 🛠️ Core Capabilities

- **ML-KEM-1024 (Kyber)**: Grade-1024 High-Security root of trust.
- **16-Round SPNA Gauntlet**: Hardened deterministic schedule (Substitution, Permutation, Network, Algebraic) every round.
- **HMAC-Linked Fusion**: Authentication-first protocol providing ML-KEM-linked integrity.
- **Hardware Binding**: Optional machine-unique entropy injection ($HWID$).

## 🚀 Performance Profile (Grade-1024)

The suite is instrumented for granular telemetry across all implementation layers. Benchmark conducted on April 13, 2026.

| Engine | Mean Latency | KEM (μs) | KDF (μs) | Gauntlet (μs) | Throughput |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Go** | 14.35 ms | 54 | 32 | 146 | 69.70 ops/s |
| **Rust** | 15.38 ms | 206 | 20 | 35 | 65.01 ops/s |
| **Node.js** | 126.84 ms | 13621 | 3059 | 1646 | 7.88 ops/s |
| **Python** | 206.54 ms | 186 | 46 | 7266 | 4.84 ops/s |

> [!NOTE]
> High-performance engines (Go, Rust) utilize native optimizations for the SPNA gauntlet. Python and Node.js prioritize branchless constant-time arithmetic for security over throughput.

---

## 🏗️ Cross-Language Implementation Parity

All implementations are designed as **high-performance, standalone sources** to ensure maximum portability and zero external cryptographic dependencies (where possible).

| Language    | Engine Path                | Core Implementation    | Constant-Time           |
| :---------- | :------------------------- | :--------------------- | :---------------------- |
| **Rust**    | `rust/src/main.rs`         | ML-KEM / SPNA Gauntlet | **Full**                |
| **Go**      | `go/main.go`               | ML-KEM / SPNA Gauntlet | **Full**                |
| **Python**  | `python/darkstar_crypt.py` | SPNA Gauntlet          | **Branchless-Equivalent**|
| **Node.js** | `node/darkstar_crypt.js`   | SPNA Gauntlet / Bridge | **Branchless-Equivalent**|

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

Released under the **MIT License**.
