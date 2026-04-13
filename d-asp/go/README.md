# D-ASP: Go Implementation

This directory contains the high-performance Go implementation of the Darkstar Algebraic Substitution & Permutation (D-ASP) protocol.

## 🚀 Status: Production

The Go implementation is designed for systems integration and high-velocity cryptographic operations, maintaining bit-perfect parity with the Rust reference.

## 🛡️ Security Profile

- **KEM**: NIST Level 5 (ML-KEM-1024) via [Cloudflare Circl](https://github.com/cloudflare/circl).
- **Hardening**:
  - Native Go `crypto/hmac` and `crypto/sha256` implementations.
  - Zero-allocation where possible to minimize memory trace.
- **Constant-Time Analysis**:
  > [!TIP]
  > **Full Constant-Time**. Similar to the reference implementation, the core algebraic transforms ($GF\_Mult$) leverage branchless masking for all reductions, ensuring secret-independent execution time.

## 🛠️ Usage

### Build
Requires Go 1.20+.
```bash
go build -o main.exe main.go
```

### Key Generation
```bash
./main.exe keygen
```

### Encryption
```bash
./main.exe encrypt "your payload" <PUBLIC_KEY_HEX>
```

### Decryption
```bash
./main.exe decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

## 🏗️ Architecture Alignment
This implementation strictly follows the [DARKSTAR_ARCHITECTURE.md](../../DARKSTAR_ARCHITECTURE.md) specification. It utilizes the same 16-round SPNA gauntlet and MDS matrix constants as the reference.
