<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../public/assets/img/logo-white.png">
    <img src="../public/assets/img/logo-black.png" alt="Darkstar Logo" width="220">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-v1.25.5-00ADD8?logo=go" alt="Go"/>
  <img src="https://img.shields.io/badge/Rust-2021-000000?logo=rust" alt="Rust"/>
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python" alt="Python"/>
  <img src="https://img.shields.io/badge/Node.js-v19%2B-339933?logo=node.js" alt="Node.js"/>
  <img src="https://img.shields.io/badge/docker-%230db7ed.svg?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

The **Darkstar Encryption Suite** is a high-performance, multi-language implementation of the Darkstar V3 security protocol. It is designed to bridge the gap between user-friendly wallet interfaces and hardened backend/utility systems, providing a consistent cryptographic standard across **Go**, **Rust**, **Python**, and **Node.js**.

The suite provides bit-perfect interoperability across all supported languages and protocol versions (V1, V2, and V3).

---

Darkstar V3 employs a multi-layered security model that fundamentally differs from standard "encrypt-and-store" approaches:

1.  **Dynamic Obfuscation Pool**: Data is passed through a transformation pipeline. The selection and order of functions are determined by a deterministic shuffle seeded by the user's password and the data itself. In V3, the depth scales dynamically (12-64 layers).
2.  **Military-Grade AES-GCM**: The obfuscated high-entropy blob is encapsulated and encrypted using **AES-256-GCM** (V3) or AES-256-CBC (V1/V2) with 600,000 PBKDF2 iterations.
3.  **ChaCha20 PRNG**: V3 utilizes a ChaCha20-based stream generator for deterministic obfuscation logic, replacing the legacy Mulberry32 engine.

| Feature                 | Description                                                       |
| :---------------------- | :---------------------------------------------------------------- |
| **AEAD Authentication** | V3 uses AES-GCM to provide built-in integrity and authenticity.   |
| **Dynamic Cycles**      | Variable gauntlet depth (12-64) for maximum transformation chaos. |
| **Interop Matrix**      | Bit-perfect matching across Go, Rust, Python, and Node.js.        |
| **Backward Compat**     | Seamlessly decrypts V1, V2, and V3 payloads.                      |
| **CLI Versioning**      | Force specific protocol versions using CLI flags.                 |

---

## 🚀 Integration Guide

Integrating Darkstar into your project is straightforward. Choose your platform below for specific implementation steps.

### 🟢 Node.js Implementation

**Target**: Web backends and desktop applications.

- **npm Package**: `@kryklin/darkstar-crypt-node`
- **Docker**: `docker build -t darkstar-node ./node`

```bash
# Install via npm
npm install @kryklin/darkstar-crypt-node
```

**Integration Snippet**:

```javascript
import { DarkstarCrypt } from '@kryklin/darkstar-crypt-node';
const crypt = new DarkstarCrypt();
const { encryptedData, reverseKey } = await crypt.encrypt('phrase', 'pass');
```

### 🔷 Go Implementation

**Target**: Performance critical backends and microservices.

- **Docker**: `docker build -t darkstar-go ./go`
- **Source**: `go/main.go`
- **Dependency**: `golang.org/x/crypto/pbkdf2`

```bash
# Register dependency
go get golang.org/x/crypto/pbkdf2
```

**Integration Snippet**:

```go
import "darkstar/go/pkg" // Reference implementation in go/main.go
dc := NewDarkstarCrypt()
result, _ := dc.Encrypt("phrase", "password")
fmt.Println(result["encryptedData"])
```

### 🦀 Rust Implementation

**Target**: System-level integration and high-security crates.

- **Docker**: `docker build -t darkstar-rust ./rust`
- **Source**: `rust/src/main.rs`
- **Dependencies**: `aes`, `cbc`, `pbkdf2`, `serde_json`

```bash
# Build standalone binary
cd rust && cargo build --release
```

**Integration Snippet**:

```rust
let dc = DarkstarCrypt::new();
let json_output = dc.encrypt("phrase", "password");
```

### 🐍 Python Implementation

**Target**: Data science, scripting, and rapid prototyping.

- **Docker**: `docker build -t darkstar-python ./python`
- **Source**: `python/darkstar_crypt.py`
- **Dependency**: `cryptography`

```bash
pip install cryptography
```

**Integration Snippet**:

```python
from darkstar_crypt import DarkstarCrypt
dc = DarkstarCrypt()
encrypted = dc.encrypt("secret", "password")
```

---

## ⌨️ CLI Usage

The Go, Rust, and Node.js implementations are pre-configured for terminal usage.

### Standard CLI (Go/Rust)

```bash
# General Command Structure
./darkstar-cli [--v3|--v2|--v1] <command> [arguments...]

# Encrypt (Defaults to V3)
./darkstar-cli encrypt <mnemonic> <password>

# Decrypt (Auto-detects version)
./darkstar-cli decrypt <payload> <reverse_key> <password>
```

### Protocol Overrides

You can force the engine to use a specific protocol version during encryption:

- `--v3`: (Default) AES-GCM + ChaCha20 + Dynamic Cycles.
- `--v2`: AES-256-CBC + Mulberry32 + 12 Cycles.
- `--v1`: AES-256-CBC + Mulberry32 + 12 Cycles + Raw Ciphertext output.

### Node.js CLI

If installed via npm:

```bash
npx darkstar-crypt <command> <payload> <password>
```

### Docker CLI

```bash
docker run --rm darkstar-<lang> <command> <payload> <password>
```

**Examples**:

```bash
# Encrypt using Docker
docker run --rm darkstar-node encrypt "my secret" "mypass"

# Run internal tests
docker run --rm darkstar-rust test
```

---

## 📜 Data Format specification

Standard output is a JSON-encapsulated object:

Standard output is a JSON-encapsulated object. The structure varies based on the protocol version:

### V3 Payload (Current Standard)

```json
{
  "v": 3,
  "data": "NONCE(12)CIPHERTEXT(B64)TAG(16)"
}
```

### V2 Payload

```json
{
  "v": 2,
  "data": "SALT(32)IV(32)CIPHERTEXT(B64)"
}
```

### V1 Payload

Raw B64 ciphertext string (legacy).

> [!IMPORTANT]
> A **Reverse Key** is produced during encryption. In V3, this key supports variable lengths. In V2.1+, it is **compressed** (binary packed & Base64 encoded). V1 uses raw JSON arrays.
> All implementations are **fully backward compatible** and will automatically detect the protocol version for decryption.

---

## ⚖️ License

The Darkstar Encryption Suite is released under the **MIT License**.
