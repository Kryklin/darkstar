# D-ASP: Rust Implementation (Reference)

<img src="https://img.shields.io/badge/Rust-v3.0.0-black?style=for-the-badge&logo=rust" alt="Rust">

This directory contains the **reference "Gold" implementation** of the Darkstar Algebraic Substitution & Permutation (D-ASP) protocol.

## 🛡️ Status: Production (Reference)

The Rust implementation serves as the definitive source of truth for bit-perfect interoperability across the Darkstar ecosystem. It is optimized for safety and performance.

## 🔒 Security Profile

- **KEM**: Grade-1024 (ML-KEM-1024).
- **Hardening**:
  - `zeroize`: All sensitive key material and internal Shared Secrets are zeroed in memory upon drop.
  - `sha2`: High-fidelity SHA-256 implementation.
- **Constant-Time Analysis**:
  > [!TIP]
  > **Full Constant-Time**. The implementation leverages branchless arithmetic for all $GF(2^8)$ operations and network layers, neutralizing timing side-channels at the hardware level.

## 🚀 Usage

### Build
Requires Rust 1.70+.
```bash
cargo build --release
```

### Key Generation
Generate a new post-quantum identity.
```bash
./target/release/d-asp keygen
```

### Encryption
```bash
./target/release/d-asp encrypt "your payload" <PUBLIC_KEY_HEX>
```

### Decryption
```bash
./target/release/d-asp decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

---

## 🏗️ Architecture Alignment
This implementation strictly follows the [DASP_CRYPTO_MATH.md](../DASP_CRYPTO_MATH.md) specification, implementing all 16 rounds of the SPNA gauntlet with deterministic ChaCha20-based path logic.

[**&larr; Back to D-ASP Suite**](../README.md) | [**Project Root**](../../README.md)
