<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: Zig Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Zig-F7A41D?style=for-the-badge&logo=zig&logoColor=white" alt="Zig">
</p>

## Overview
This is the Zig implementation of the **ASP Cascade 16 (D-ASP)** engine. It demonstrates Zig's powerful C interop and SIMD capabilities, seamlessly linking to the C engine sources to provide a high-throughput, constant-time wrapper with near zero-overhead.

## Prerequisites
- Zig 0.16.0+

## Build Instructions
```bash
zig build
```

## Detailed Usage
The Zig executable conforms to the standard D-ASP CLI interface, utilizing JSON for cryptographic payloads to ensure cross-language compatibility.

**Encrypting a Payload:**
```bash
./dist/d-asp_zig encrypt <payload_string> <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Decrypting a Payload:**
```bash
./dist/d-asp_zig decrypt <json_payload_string> <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
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
Based on the latest benchmarking session (`interop`), the Zig engine achieved the following hardware-accelerated telemetry:

| Metric | Recorded Value |
| :--- | :--- |
| **Total Pipeline Time** | `13.51 ms` |
| **ASP Cascade Time** | `185 μs` |
| **Total CPB** | `490.07` |
| **Ops/sec** | `74.01` |

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
