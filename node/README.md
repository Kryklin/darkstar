<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: Node.js Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
</p>

## Overview
This is the Node.js implementation of the **ASP Cascade 16 (D-ASP)** engine. It uses WebAssembly (WASM) generated from the Rust core to achieve near-native performance and constant-time execution inside the V8 JS engine.

## Prerequisites
- Node.js 18+
- npm

## Build Instructions
```bash
npm install
npm run build
```

## Detailed Usage
The Node.js executable conforms to the standard D-ASP CLI interface, utilizing JSON for cryptographic payloads to ensure cross-language compatibility.

**Encrypting a Payload:**
```bash
node dist/main.js encrypt <payload_string> <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Decrypting a Payload:**
```bash
node dist/main.js decrypt <json_payload_string> <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
```

**Generating a Keypair:**
```bash
node dist/main.js keygen
```

**Running Self-Test:**
```bash
node dist/main.js test
```

**Rebinding a Payload (Migration):**
```bash
node dist/main.js rebind <json_payload> <old_sk_hex> <new_pk_hex> [--hwid <old_hwid>] [--new-hwid <new_hwid>]
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
Based on the latest benchmarking session (`interop`), the Node.js engine achieved the following hardware-accelerated telemetry:

| Metric | Recorded Value |
| :--- | :--- |
| **Total Pipeline Time** | `20.324 ms` |
| **ASP Cascade Time** | `2.555 ms` |
| **Total CPB** | `737.47` |
| **Ops/sec** | `391.33` |

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
