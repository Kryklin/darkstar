# Darkstar Encryption Suite

**Version**: 1.0.0
**Encryption Schema**: V2 (Dynamic Obfuscation + AES-256-CBC)

The Darkstar Encryption Suite provides a robust, multi-language implementation of the Darkstar V2 encryption protocol. This protocol combines a dynamic, seed-based obfuscation pipeline with standard AES-256-CBC encryption to provide defense system-grade security for mnemonic phrases and sensitive data.

## Features

- **Dynamic Obfuscation**: Uses a 12-layer obfuscation pipeline where the order of operations is uniquely determined by the password and data content itself.
- **Deterministic PRNG**: Implements `Mulberry32` for consistent cross-language pseudo-random number generation.
- **Standard Crypto**: Utilizes AES-256-CBC with PBKDF2 (HMAC-SHA256) for the core cryptographic layer.
- **integrity**: Obfuscation layers include checksums to validate decryption integrity.
- **Cross-Compatible**: All implementations (Node.js, Python, Go, Rust) are fully interoperable.

## Implementations

This repository contains implementations in four languages:


### 1. Node.js

Located in `./node`
- **File**: `darkstar_crypt.js`
- **Usage**: Import `DarkstarCrypt` class.
- **Dependencies**: Native `crypto` (Node 19+ or polyfill).

```javascript
import { DarkstarCrypt } from './node/darkstar_crypt.js';
const crypt = new DarkstarCrypt();
const encrypted = await crypt.encrypt("my secret phrase", "password123");
```


### 2. Python

Located in `./python`
- **File**: `darkstar_crypt.py`
- **Usage**: Import `DarkstarCrypt` class.
- **Dependencies**: `cryptography`

  ```bash
  pip install cryptography
  ```

```python
from python.darkstar_crypt import DarkstarCrypt
crypt = DarkstarCrypt()
encrypted = crypt.encrypt("my secret phrase", "password123")
```


### 3. Go

Located in `./go`
- **File**: `main.go`
- **Build**: `go build -o darkstar-go main.go`
- **CLI Usage**:
  ```bash
  # Encrypt
  go run main.go encrypt "my secret phrase" "password123"

  # Decrypt
  go run main.go decrypt '{"v":2,"data":"..."}' "<reverse_key>" "password123"

  # Test
  go run main.go test
  ```


### 4. Rust

Located in `./rust`
- **File**: `src/main.rs`
- **Build**: `cargo build --release`
- **CLI Usage**:
  ```bash
  # Encrypt
  cargo run -- encrypt "my secret phrase" "password123"

  # Decrypt
  cargo run -- decrypt '{"v":2,"data":"..."}' "<reverse_key>" "password123"

  # Test
  cargo run -- test
  ```

## Integration Guide

To integrate Darkstar into your project:

1.  **Choose your language** folder.
2.  **Copy the core file** (`darkstar_crypt.js`, `darkstar_crypt.py`, etc.) into your project's utility or crypto directory.
3.  **Install dependencies** listed above.
4.  **Instantiate and use** the `encrypt` and `decrypt` methods.

## Data Format

The output of the encryption is a JSON object (stringified) containing:
- `v`: Version number (2)
- `data`: AES encrypted string (containing the obfuscated blob)

Along with a strict `reverseKey` (Base64) which is required for decryption.

**Note**: The obfuscation layer adds significant entropy and structure hiding before the data even reaches the AES encryption step.
