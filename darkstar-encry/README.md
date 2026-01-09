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

# Darkstar Encryption Suite

> **Defense-in-Depth for Digital Mnemonic Assets**

The **Darkstar Encryption Suite** is a high-performance, multi-language implementation of the Darkstar V2 security protocol. It is designed to bridge the gap between user-friendly wallet interfaces and hardened backend/utility systems, providing a consistent cryptographic standard across **Go**, **Rust**, **Python**, and **Node.js**.

---

## 🛡️ Security Architecture

Darkstar V2 employs a dual-layered security model that fundamentally differs from standard "encrypt-and-store" approaches:

1.  **Dynamic Obfuscation Pool**: Data is passed through a 12-stage transformation pipeline. The selection and order of these functions are determined by a deterministic shuffle seeded by the user's password and the data itself.
2.  **Military-Grade AES**: The obfuscated high-entropy blob is encapsulated and encrypted using AES-256-CBC with 600,000 PBKDF2 iterations.

| Feature               | Description                                                           |
| :-------------------- | :-------------------------------------------------------------------- |
| **Entropy Injection** | Obfuscation layers maximize data chaos before AES encryption.         |
| **Cross-Language**    | Standardized `Mulberry32` PRNG ensures bit-perfect interop.           |
| **CLI Ready**         | Optimized for secure, air-gapped terminal operations.                 |
| **Integrity Checks**  | Built-in checksums validate the successful reversal of all 12 layers. |

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
./darkstar-cli <command> <payload> <password>
```

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

```json
{
  "v": 2,
  "data": "SALT(32)IV(32)CIPHERTEXT(B64)"
}
```

> [!IMPORTANT]
> A **Reverse Key** is produced during encryption. In V2.1+, this key is **compressed** (binary packed & Base64 encoded) to reduce size by ~75%.
> The implementations are **backward compatible** and will automatically detect and accept legacy JSON-formatted reverse keys.
> This key is **stateless** and must be stored securely alongside the encrypted data to enable decryption.

---

## ⚖️ License

The Darkstar Encryption Suite is released under the **MIT License**.
