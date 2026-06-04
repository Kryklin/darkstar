<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: Python Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
</p>

## Overview
This is the Python 3 implementation of the **ASP Cascade 16 (D-ASP)** engine. It uses the `wasmtime` runtime to execute WebAssembly (WASM) compiled from the core Rust logic, guaranteeing constant-time execution while keeping a pythonic interface.

## Prerequisites
- Python 3.8+
- `wasmtime` Python package

## Build Instructions
```bash
pip install -r requirements.txt
python build.py
```

## Detailed Usage
The Python executable conforms to the standard D-ASP CLI interface, utilizing JSON for cryptographic payloads to ensure cross-language compatibility.

**Encrypting a Payload:**
```bash
python dist/dasp.py encrypt <payload_string> <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Decrypting a Payload:**
```bash
python dist/dasp.py decrypt <json_payload_string> <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
```

**Generating a Keypair:**
```bash
python dist/dasp.py keygen
```

**Running Self-Test:**
```bash
python dist/dasp.py test
```

**Rebinding a Payload (Migration):**
```bash
python dist/dasp.py rebind <json_payload> <old_sk_hex> <new_pk_hex> [--hwid <old_hwid>] [--new-hwid <new_hwid>]
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
Based on the latest benchmarking session (`interop`), the Python engine achieved the following hardware-accelerated telemetry:

| Metric | Recorded Value |
| :--- | :--- |
| **Total Pipeline Time** | `3.433 ms` |
| **ASP Cascade Time** | `708 μs` |
| **Total CPB** | `124.59` |
| **Ops/sec** | `1413.43` |

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
