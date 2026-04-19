<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../public/assets/img/logo-white.png">
    <img src="../../public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: C Reference Implementation

<img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c" alt="C">

This directory contains the original native C reference implementation of the **ASP Cascade 16** engine, part of the D-ASP protocol suite.

## 🛡️ Status: Production Reference

The C implementation is designed to serve as the exact procedural specification for all other ecosystem languages. It maintains bit-perfect parity with the Rust reference while ensuring the strictest compliance methodologies without high-level language abstractions.

## 🔒 Security Profile

- **KEM**: NIST Level 5 (ML-KEM-1024) instantiated via standard `dasp_crypto` Rust FFI bindings to guarantee bit-consistency across ecosystem.
- **Hardening**:
  - Implements the formal 13 DSP transformations in raw memory constructs to minimize tracing payload footprint.
  - Constant-time verifiable native comparisons (e.g., `timing_safe_cmp` for MAC verification matching `timingSafeEqual`).
- **Constant-Time Analysis**:
  > [!TIP]
  > **Full Constant-Time**. Similar to the Rust standard, the core algebraic transforms leverage strict branchless bitwise operations (`d_asp_gf_mult`) and constant-time memcmp derivations, preventing all timing and padding oracle side-channels.

## 🚀 Usage

### Build (NIST Reference Implementation)
Requires `clang` natively installed. Build the core engine using the following command:
```bash
clang -o dasp.exe main.c spna_engine.c gf_math.c ml_kem.c fips202.c sha256.c aes.c rng.c -I. -lws2_32 -luserenv -ladvapi32 -lbcrypt
```

### Key Generation
```bash
./dasp.exe keygen
```

### Encryption (NIST KEM-DEM Hybrid)
```bash
./dasp.exe encrypt "your payload" <PK_HEX> [--hwid <HWID_HEX>]
```

### Decryption
```bash
./dasp.exe decrypt '{"data":"...","ct":"...","mac":"..."}' <SK_HEX> [--hwid <HWID_HEX>]
```

---

## 🏗️ Architecture Alignment
This implementation closely shadows the design intent outlined in [DASP_CRYPTO_MATH.md](../DASP_CRYPTO_MATH.md). All substitution and permutation network logic directly models the NIST-compliant structure. 

[**&larr; Back to D-ASP Suite**](../README.md) | [**Project Root**](../../README.md)
