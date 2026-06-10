<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/header-anim-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/header-anim-light.svg">
    <img alt="D-SPNA-512 Header" src="assets/header-anim-dark.svg" width="100%">
  </picture>
</p>

# D-SPNA-512 (Darkstar Substitution Permutation Network Algebraic)

**D-SPNA-512** is a post-quantum, military-grade cryptographic engine designed for extreme performance and absolute security. Upgraded from the legacy D-ASP architecture, D-SPNA-512 features a full 512-bit security barrier, hybrid ML-KEM-1024 quantum-resistant key encapsulation, and universal vector acceleration (AVX-512, AVX2, ARM NEON).

## Core Architecture
- **512-Bit Security State**: The deterministic underlying PRNG permutation matrix is seeded via a 512-bit state derived from a Post-Quantum KEM and HKDF expansion, rendering brute-force attacks mathematically impossible even for quantum computers.
- **ML-KEM-1024 Hybrid Encapsulation**: Strictly adheres to FIPS 203 for key encapsulation, embedding a pristine ML-KEM-1024 shared secret directly into the cryptographic core.
- **ARX Vector Engine**: Operates natively on 128-bit (ARM NEON), 256-bit (AVX2), and 512-bit (AVX-512) vectors using purely Addition-Rotation-XOR (ARX) operations, completely bypassing memory S-box lookups to ensure constant-time execution.

## Hardware Defenses
- **Spectre / Meltdown Shielding**: Enforces strict `lfence` (x86) and `isb`/`csdb` (ARM) pipeline flushes immediately upon MAC authentication failure, mathematically preventing speculative execution leaks.
- **Zenbleed Erase (CVE-2023-20593)**: Forces explicit `vpxor` micro-ops via `_mm256_setzero_si256` and `vdupq_n_u32` to zero out all physical SIMD hardware registers before context switching, blocking cross-process state leakage.
- **DPA Pattern Rejection**: Integrates an active ring-buffer tracking mechanism to reject repeated ML-KEM signatures, shutting down Differential Power Analysis attempts.

Explore the [C Engine](c/README.md), [Rust Engine](rust/README.md), and [CUDA Engine](cuda/README.md) for implementation details.
