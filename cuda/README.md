<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../public/assets/img/logo-white.png">
    <img src="../../public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: CUDA Implementation (GPU Acceleration)

<img src="https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="CUDA">

This directory contains the **Massively Parallel GPU Accelerated** implementation of the **ASP Cascade 16 (D-ASP)** protocol using CUDA.

## 🛡️ Status: High-Performance Accelerator

The CUDA implementation serves to provide massive parallel throughput for enterprise-scale key operations and exhaustive testing. It maintains bit-perfect interoperability across the Darkstar ecosystem while leveraging the parallel execution architecture of NVIDIA GPUs.

## 🔒 Security Profile

- **KEM**: Grade-1024 (ML-KEM-1024 / Kyber).
- **Hardening**:
  - `memory separation`: Device and Host memory boundaries enforce strict compartmentalization of sensitive keys during payload processing.
- **Constant-Time Analysis**:
  > [!TIP]
  > **Full Constant-Time**. The implementation leverages warp-synchronous, branchless arithmetic for all $GF(2^8)$ operations and network layers inside the GPU kernels, neutralizing timing side-channels and avoiding thread divergence.

## 🚀 Usage

### Prerequisites

Requires **NVIDIA CUDA Toolkit (nvcc)** installed and configured in your environment.

### Build (Windows)

```cmd
build_cuda.bat
```

### Key Generation

Generate a new post-quantum identity.

```bash
./d-asp_cuda.exe keygen
```

### Encryption

```bash
./d-asp_cuda.exe encrypt "your payload" <PUBLIC_KEY_HEX>
```

### Decryption

```bash
./d-asp_cuda.exe decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

### Verification Test

Run the self-contained verification suite on the GPU:

```bash
./d-asp_cuda.exe test
```

### High-Throughput Benchmarking

Run the built-in streaming benchmark to measure maximum PCIe and Pure GPU execution throughput:

```bash
./d-asp_cuda.exe benchmark 5
```

> [!TIP]
> **Performance**: The VRAM-optimized kernel features `__constant__` cache broadcasts and 128-bit vectorized `uint4` memory transactions, achieving **118.49 GB/s** pure computational throughput and fully saturating PCIe 4.0 buses during H2D/D2H transfers.

---

## 🏗️ Architecture Alignment

This implementation strictly follows the [DASP_CRYPTO_MATH.md](../DASP_CRYPTO_MATH.md) specification, implementing all 16 rounds of the **ASP Cascade** engine natively in CUDA kernels to ensure bit-perfect ciphertext parity with Rust, Go, C, Node.js, and Python.

[**&larr; Back to D-ASP Suite**](../README.md) | [**Project Root**](../../README.md)
