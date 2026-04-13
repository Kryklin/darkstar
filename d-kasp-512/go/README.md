# D-KASP: Go Implementation

This directory contains the high-performance Go implementation of the Darkstar Key-Agnostic Structural Permutation (D-KASP) protocol.

## 🚀 Status: Production

The Go implementation is designed for systems integration and high-velocity cryptographic operations, maintaining bit-perfect parity with the Rust reference.

## 🛡️ Security Profile

- **KEM**: NIST Level 5 (ML-KEM-1024) via [Cloudflare Circl](https://github.com/cloudflare/circl).
- **Hardening**:
  - Native Go `crypto/hmac` and `crypto/sha256` implementations.
  - Zero-allocation where possible to minimize memory trace.
- **Constant-Time Analysis**:
  > [!NOTE]
  > **Partial Constant-Time**. Similar to the Rust implementation, the core algebraic transforms ($GF\_Mult$) utilize conditional branching for polynomial reduction.

## 🛠️ Usage

### Build
Requires Go 1.20+.
```bash
go build -o d-kasp-512.exe main.go
```

### Key Generation
```bash
./d-kasp-512.exe keygen
```

### Encryption
```bash
./d-kasp-512.exe encrypt "your mnemonic phrase" <PUBLIC_KEY_HEX>
```

### Decryption
```bash
./d-kasp-512.exe decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

## 🏗️ Architecture Alignment
This implementation strictly follows the [DARKSTAR_ARCHITECTURE.md](../../DARKSTAR_ARCHITECTURE.md) specification. It utilizes the same 16-round SPNA gauntlet and MDS matrix constants as the reference.
