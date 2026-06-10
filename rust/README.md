# D-SPNA-512 Rust Engine

The Rust implementation provides memory-safe, ultra-fast cryptographic execution natively leveraging `core::arch`.

## Architecture
- **Dynamic Dispatch**: Uses `is_x86_feature_detected!` to select AVX-512 (`zmm`), AVX2 (`ymm`), or falls back to scalar arrays natively.
- **ARM NEON**: Compiles with `#[target_feature(enable = "neon")]` to utilize 128-bit tandem vectors.
- **Hardware Mitigations**: Implements `std::ptr::write_volatile` to force SIMD register zeroes (`vpxor`) to block Zenbleed. Emits `_mm_lfence` and `isb` macros for Spectre resilience.

## Build
```bash
cargo build --release
cargo test
```
