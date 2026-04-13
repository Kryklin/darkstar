# D-KASP: Node.js / Javascript Implementation

This directory contains the Node.js (ESM) implementation of the Darkstar Key-Agnostic Structural Permutation (D-KASP) protocol.

## 🚀 Status: Production Bridge

The Node.js implementation acts as the primary bridge for web applications and Electron-based host environments. It is designed for maximum interoperability with the Rust reference.

## 🛡️ Security Profile

- **KEM**: NIST Level 5 (ML-KEM-1024) via [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum).
- **Hardening**:
  - Leverages Node.js `crypto` module for high-entropy PBKDF2 and SHA-256 operations.
  - Implements `timingSafeEqual` for MAC verification.
- **Constant-Time Analysis**:
  > [!WARNING]
  > **Non-Constant-Time**. Due to the nature of the V8 JavaScript engine (JIT compilation, Garbage Collection, and object overhead), this implementation cannot guarantee constant-time execution. It is intended for environments where the host assumes security responsibility.

## 🛠️ Usage

### Install Dependencies
```bash
npm install
```

### Key Generation
```bash
node darkstar_crypt.js keygen
```

### Encryption
```bash
node darkstar_crypt.js encrypt "your mnemonic phrase" <PUBLIC_KEY_HEX>
```

### Decryption
```bash
node darkstar_crypt.js decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

## 🏗️ Architecture Alignment
This implementation strictly follows the [DARKSTAR_ARCHITECTURE.md](../../DARKSTAR_ARCHITECTURE.md) specification. It utilizes identical AES S-Box and MDS matrix constants to ensure bit-perfect cross-platform recovery.
