# D-SPNA-512 CUDA Engine

The CUDA implementation is designed to offload massive batches of the D-SPNA-512 ARX cascade to NVIDIA GPUs.

## Architecture
- **PTX Parallelism**: Executes thousands of 256-bit block cascades in parallel utilizing GPU thread warps.
- **Memory Coalescing**: KEM states and block structures are aligned to optimize VRAM bandwidth.
- **Host-Device Sync**: The host manages the ML-KEM-1024 encapsulation (which is inherently serial), while the device handles the symmetric ARX offloading.

## Build
Run `build_cuda.bat` (requires NVIDIA nvcc toolkit).
