# D-KASP: Rust Implementation (Reference)

This directory contains the **reference "Gold" implementation** of the Darkstar Key-Agnostic Structural Permutation (D-KASP) protocol.

## 🚀 Status: Production (Reference)

The Rust implementation serves as the definitive source of truth for bit-perfect interoperability across the Darkstar ecosystem. It is optimized for safety and performance.

## 🛡️ Security Profile

- **KEM**: NIST Level 5 (ML-KEM-1024).
- **Hardening**:
  - `zeroize`: All sensitive key material and internal Shared Secrets are zeroed in memory upon drop.
  - `sha2`: High-fidelity SHA-256 implementation.
- **Constant-Time Analysis**:
  > [!NOTE]
  > **Partial Constant-Time**. The implementation uses bitwise operations for permutation and network layers. However, the Galois Field multiplication ($GF\_Mult$) contains conditional branches for polynomial reduction.

## 🛠️ Usage

### Build
Requires Rust 1.70+.
```bash
cargo build --release
```

### Key Generation
Generate a new post-quantum identity.
```bash
./target/release/darkstar keygen
```

### Encryption
```bash
./target/release/darkstar encrypt "your mnemonic phrase" <PUBLIC_KEY_HEX>
```

### Decryption
```bash
./target/release/darkstar decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

## 🏗️ Architecture Alignment
This implementation strictly follows the [DARKSTAR_ARCHITECTURE.md](../../DARKSTAR_ARCHITECTURE.md) specification, implementing all 16 rounds of the SPNA gauntlet with deterministic ChaCha20-based path logic.
