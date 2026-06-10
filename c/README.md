<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DSPNA_512_CRYPTO_MATH.md) | [⚙️ System Flows](../DSPNA_512_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DSPNA_512_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-SPNA-512: C Implementation

<p align="left">
  <img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=white" alt="C">
</p>

## Overview
This is the C/C++ implementation of the **ASP Cascade 16 (D-SPNA-512)** engine. It offers a highly optimized, constant-time `spna_engine.c` FFI library capable of integrating seamlessly with low-level systems and providing interoperability targets for high-level language wrappers.

## Prerequisites
- MSVC Toolchain (Visual Studio) or compatible `cl.exe` (Windows)
- LLVM / Clang (Alternative for strict C11 compilation)

## Build Instructions
Run the provided batch script to build the main executable and the interoperability DLL:
```cmd
build.bat
```

## Detailed Usage
The C/C++ executable conforms to the standard D-SPNA-512 CLI interface, utilizing JSON for cryptographic payloads to ensure cross-language compatibility.

**Encrypting a Payload (Single String):**
```bash
./dasp encrypt "my secret payload" <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Encrypting a Payload (From File):**
```bash
./dasp encrypt @payload.txt <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Streaming Encryption (STDIN to STDOUT):**
```bash
cat payload.txt | ./dasp stream-encrypt <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry] > output.json
```

**Decrypting a Payload (Single String):**
```bash
./dasp decrypt <json_payload_string> <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
```

**Decrypting a Payload (From File):**
```bash
./dasp decrypt @output.json <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
```

**Streaming Decryption (STDIN to STDOUT):**
```bash
cat output.json | ./dasp stream-decrypt <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry] > decrypted.txt
```

**Generating a Keypair:**
```bash
./dasp keygen
```

**Running Self-Test:**
```bash
./dasp test
```

**Rebinding a Payload (Migration):**
```bash
./dasp rebind <json_payload> <old_sk_hex> <new_pk_hex> [--hwid <old_hwid>] [--new-hwid <new_hwid>]
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
Based on the latest benchmarking session (`interop`), the C/C++ engine achieved the following hardware-accelerated telemetry:

| Metric | Recorded Value |
| :--- | :--- |
| **Cascade Time** | `249.55 μs` |
| **Cascade CPB** | `12.19` |
| **Ops/sec** | `4,007` |
| **Throughput** | `273.9 MB/s` |

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DSPNA_512_CRYPTO_MATH.md) | [⚙️ System Flows](../DSPNA_512_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DSPNA_512_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>


## 🔬 Cryptographic Analysis Suite

This C implementation is fully integrated with the D-SPNA-512 exhaustive mathematical testing suite. By running the global dashboard, you can automatically evaluate this engine's output against:
- **Entropy & Diffusion:** Shannon Entropy, Strict Avalanche Criterion (SAC), Cross-Key Diffusion.
- **Uniformity & Sequences:** Chi-Square, Serial Autocorrelation, Monte Carlo Pi Estimation, Monobit Frequency, Runs Tests.
- **Side-Channel Immunity:** Constant-Time Execution Variance.

Additionally, you can run `npm run gen-nist` from the root directory to stream gigabytes of raw ciphertext from this engine directly into `.bin` files for external certification via the official NIST SP 800-22 `sts` suite.
