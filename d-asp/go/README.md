<p align="left">
  <img src="../../public/assets/img/logo-white.png" width="120" alt="Darkstar Logo">
</p>

# D-ASP: Go Implementation

<img src="https://img.shields.io/badge/Go-v3.0.0-00ADD8?style=for-the-badge&logo=go" alt="Go">

This directory contains the high-performance Go implementation of the Darkstar Algebraic Substitution & Permutation (D-ASP) protocol.

## 🛡️ Status: Production

The Go implementation is designed for systems integration and high-velocity cryptographic operations, maintaining bit-perfect parity with the Rust reference.

## 🔒 Security Profile

- **KEM**: NIST Level 5 (ML-KEM-1024) via [Cloudflare Circl](https://github.com/cloudflare/circl).
- **Hardening**:
  - Native Go `crypto/hmac` and `crypto/sha256` implementations.
  - Zero-allocation where possible to minimize memory trace.
- **Constant-Time Analysis**:
  > [!TIP]
  > **Full Constant-Time**. Similar to the reference implementation, the core algebraic transforms ($GF\_Mult$) leverage branchless masking for all reductions, ensuring secret-independent execution time.

## 🚀 Usage

### Build
Requires Go 1.25+.
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

---

## 🏗️ Architecture Alignment
This implementation strictly follows the [DASP_CRYPTO_MATH.md](../DASP_CRYPTO_MATH.md) specification. It utilizes the same 16-round SPNA gauntlet and MDS matrix constants as the reference.

[**&larr; Back to D-ASP Suite**](../README.md) | [**Project Root**](../../README.md)
