<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: CUDA Implementation

<p align="left">
  <img src="https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="CUDA">
</p>

## Overview
This is the CUDA-accelerated implementation of the **ASP Cascade 16 (D-ASP)** engine. It leverages advanced VRAM-optimized kernels, `__constant__` cache broadcasts, and 128-bit vectorized `uint4` transactions to deliver massive multi-gigabyte throughput.

## Prerequisites
- NVIDIA CUDA Toolkit (nvcc)
- Compatible NVIDIA GPU

## Build Instructions
Run the provided build script:
```bash
build_cuda.bat
```

## Usage
```bash
dasp_cuda encrypt <payload> <pk_hex> [--hwid <hex>] [--telemetry]
dasp_cuda decrypt <json_payload> <sk_hex> [--hwid <hex>] [--telemetry]
```

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
