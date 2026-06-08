<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: Rust Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
</p>

## Overview
This is the native Rust implementation and the core reference engine for the **ASP Cascade 16 (D-ASP)** suite. It is built for raw performance, memory safety, and produces both native executables and WASM targets for dynamic language integration.

## Prerequisites
- Rust (Cargo) 1.70+

## Build Instructions
```bash
cargo build --release
```

## Detailed Usage
The Rust executable conforms to the standard D-ASP CLI interface, utilizing JSON for cryptographic payloads to ensure cross-language compatibility.

**Encrypting a Payload (Single String):**
```bash
./target/release/d-asp encrypt "my secret payload" <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Encrypting a Payload (From File):**
```bash
./target/release/d-asp encrypt @payload.txt <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Streaming Encryption (STDIN to STDOUT):**
```bash
cat payload.txt | ./target/release/d-asp stream-encrypt <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry] > output.json
```

**Decrypting a Payload (Single String):**
```bash
./target/release/d-asp decrypt <json_payload_string> <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
```

**Decrypting a Payload (From File):**
```bash
./target/release/d-asp decrypt @output.json <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
```

**Streaming Decryption (STDIN to STDOUT):**
```bash
cat output.json | ./target/release/d-asp stream-decrypt <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry] > decrypted.txt
```

**Generating a Keypair:**
```bash
./target/release/d-asp keygen
```

**Running Self-Test:**
```bash
./target/release/d-asp test
```

**Rebinding a Payload (Migration):**
```bash
./target/release/d-asp rebind <json_payload> <old_sk_hex> <new_pk_hex> [--hwid <old_hwid>] [--new-hwid <new_hwid>]
```

## Recommended Usage
> [!TIP]
> **Hardware Binding (HUB)**
> It is highly recommended to always pass the `--hwid` flag (a 64-character hex string representing machine identity) during both encryption and decryption. This prevents "Static State Theft" by ensuring the resulting payload can only be decrypted on the specific machine it was encrypted for.

## Error Codes
The CLI returns the following standard error contexts directly to `stderr` alongside an exit code of `1`:

| Error Context | Cause | Resolution |
| :--- | :--- | :--- |
| **`DecapsulationFailed`** | The provided `sk_hex` is invalid or does not match the public key used during encryption. | Verify the ML-KEM-1024 keypair generation. |
| **`IntegrityFailed`** / **`HMAC Error`** | The payload has been tampered with, or the wrong `hwid` was provided during decryption. | Ensure identical `--hwid` is used and payload JSON is untouched. |
| **`Invalid Arguments`** | Missing required parameters or incorrect hexadecimal lengths. | Ensure keys are full hex strings and HWID is exactly 64 characters. |

## Engine-Specific Metrics
Based on the latest benchmarking session (`interop`), the Rust engine achieved the following hardware-accelerated telemetry:

| Metric | Recorded Value |
| :--- | :--- |
| **Cascade Time** | `134.91 μs` |
| **Cascade CPB** | `6.59` |
| **Ops/sec** | `7,412` |
| **Throughput** | `506.7 MB/s` |

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>


## 🔬 Cryptographic Analysis Suite

This Rust implementation is fully integrated with the D-ASP exhaustive mathematical testing suite. By running the global dashboard, you can automatically evaluate this engine's output against:
- **Entropy & Diffusion:** Shannon Entropy, Strict Avalanche Criterion (SAC), Cross-Key Diffusion.
- **Uniformity & Sequences:** Chi-Square, Serial Autocorrelation, Monte Carlo Pi Estimation, Monobit Frequency, Runs Tests.
- **Side-Channel Immunity:** Constant-Time Execution Variance.

Additionally, you can run `npm run gen-nist` from the root directory to stream gigabytes of raw ciphertext from this engine directly into `.bin` files for external certification via the official NIST SP 800-22 `sts` suite.
