[⬅ Back to Main README](../README.md)

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
