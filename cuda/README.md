<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DSPNA_512_CRYPTO_MATH.md) | [⚙️ System Flows](../DSPNA_512_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DSPNA_512_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-SPNA-512: CUDA Implementation

<p align="left">
  <img src="https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="CUDA">
</p>

## Overview
This is the CUDA-accelerated implementation of the **ASP Cascade 16 (D-SPNA-512)** engine. It leverages advanced VRAM-optimized kernels, `__constant__` cache broadcasts, and 128-bit vectorized `uint4` transactions to deliver massive multi-gigabyte throughput.

## Prerequisites
- NVIDIA CUDA Toolkit (nvcc)
- Compatible NVIDIA GPU

## Build Instructions
Run the provided build script:
```bash
build_cuda.bat
```

## Detailed Usage
The CUDA executable conforms to the standard D-SPNA-512 CLI interface, utilizing JSON for cryptographic payloads to ensure cross-language compatibility.

**Encrypting a Payload (Single String):**
```bash
./d-spna-512_cuda encrypt "my secret payload" <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Encrypting a Payload (From File):**
```bash
./d-spna-512_cuda encrypt @payload.txt <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry]
```

**Streaming Encryption (STDIN to STDOUT):**
```bash
cat payload.txt | ./d-spna-512_cuda stream-encrypt <ml_kem_public_key_hex> [--hwid <hex>] [--telemetry] > output.json
```

**Decrypting a Payload (Single String):**
```bash
./d-spna-512_cuda decrypt <json_payload_string> <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
```

**Decrypting a Payload (From File):**
```bash
./d-spna-512_cuda decrypt @output.json <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry]
```

**Streaming Decryption (STDIN to STDOUT):**
```bash
cat output.json | ./d-spna-512_cuda stream-decrypt <ml_kem_secret_key_hex> [--hwid <hex>] [--telemetry] > decrypted.txt
```

**Generating a Keypair:**
```bash
./d-spna-512_cuda keygen
```

**Running Self-Test:**
```bash
./d-spna-512_cuda test
```

**Rebinding a Payload (Migration):**
> [!NOTE]
> The CUDA engine does not support `rebind` directly due to GPU memory zeroization constraints.
> Use any CPU-based engine (Rust, C, or a scaffolded wrapper) for migration operations.

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
Based on the latest benchmarking session (`interop`), the CUDA engine achieved the following hardware-accelerated telemetry:

| Metric | Recorded Value |
| :--- | :--- |
| **Cascade Time** | `156.44 μs` |
| **Cascade CPB** | `7.64` |
| **Ops/sec** | `6,392` |
| **Throughput** | `437.0 MB/s` |

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DSPNA_512_CRYPTO_MATH.md) | [⚙️ System Flows](../DSPNA_512_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DSPNA_512_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>


## 🔬 Cryptographic Analysis Suite

This Cuda implementation is fully integrated with the D-SPNA-512 exhaustive mathematical testing suite. By running the global dashboard, you can automatically evaluate this engine's output against:
- **Entropy & Diffusion:** Shannon Entropy, Strict Avalanche Criterion (SAC), Cross-Key Diffusion.
- **Uniformity & Sequences:** Chi-Square, Serial Autocorrelation, Monte Carlo Pi Estimation, Monobit Frequency, Runs Tests.
- **Side-Channel Immunity:** Constant-Time Execution Variance.

Additionally, you can run `npm run gen-nist` from the root directory to stream gigabytes of raw ciphertext from this engine directly into `.bin` files for external certification via the official NIST SP 800-22 `sts` suite.
