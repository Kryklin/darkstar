# D-KASP: Python Implementation

This directory contains the Python implementation of the Darkstar Key-Agnostic Structural Permutation (D-KASP) protocol.

## 🚀 Status: Interoperability Script

The Python implementation is provided primarily for cross-platform validation, research, and standalone recovery in environments where native binaries are not feasible.

## 🛡️ Security Profile

- **KEM**: NIST Level 5 (ML-KEM-1024) via [`pqcrypto`](https://github.com/kpeters93/pqcrypto).
- **Hardening**:
  - Uses `hmac.compare_digest` for timing-resistant MAC validation.
  - Relies on Standard Library `hashlib` for SHA-256.
- **Constant-Time Analysis**:
  > [!WARNING]
  > **Non-Constant-Time**. Python's interpreter overhead and dynamic memory management prevent constant-time guarantees. This implementation is intended for low-bandwidth, high-auditability use cases.

## 🛠️ Usage

### Install Dependencies
Requires Python 3.9+.
```bash
pip install -r requirements.txt
```

### Key Generation
```bash
python darkstar_crypt.py keygen
```

### Encryption
```bash
python darkstar_crypt.py encrypt "your mnemonic phrase" <PUBLIC_KEY_HEX>
```

### Decryption
```bash
python darkstar_crypt.py decrypt '{"data":"...","ct":"...","mac":"..."}' <SECRET_KEY_HEX>
```

## 🏗️ Architecture Alignment
This implementation adheres to the [DARKSTAR_ARCHITECTURE.md](../../DARKSTAR_ARCHITECTURE.md) specification, implementing the full 16-round SPNA-structured gauntlet to ensure bit-perfect ciphertext parity with Rust, Go, and Node.js.
