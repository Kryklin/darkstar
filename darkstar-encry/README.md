<p align="center">
  <img src="../public/assets/img/logo-black.png" alt="Darkstar Logo" width="180">
</p>

# Darkstar Encryption Suite
> **Defense-in-Depth for Digital Mnemonic Assets**

The **Darkstar Encryption Suite** is a high-performance, multi-language implementation of the Darkstar V2 security protocol. It is designed to bridge the gap between user-friendly wallet interfaces and hardened backend/utility systems, providing a consistent cryptographic standard across **Go**, **Rust**, **Python**, and **Node.js**.

---

## 🛡️ Security Architecture

Darkstar V2 employs a dual-layered security model that fundamentally differs from standard "encrypt-and-store" approaches:

1.  **Dynamic Obfuscation Pool**: Data is passed through a 12-stage transformation pipeline. The selection and order of these functions are determined by a deterministic shuffle seeded by the user's password and the data itself.
2.  **Military-Grade AES**: The obfuscated high-entropy blob is encapsulated and encrypted using AES-256-CBC with 600,000 PBKDF2 iterations.

| Feature | Description |
| :--- | :--- |
| **Entropy Injection** | Obfuscation layers maximize data chaos before AES encryption. |
| **Cross-Language** | Standardized `Mulberry32` PRNG ensures bit-perfect interop. |
| **CLI Ready** | Optimized for secure, air-gapped terminal operations. |
| **Integrity Checks** | Built-in checksums validate the successful reversal of all 12 layers. |

---

## 🚀 Integration Guide

Integrating Darkstar into your project is straightforward. Choose your platform below for specific implementation steps.

### 🔷 Go Implementation
**Target**: Performance critical backends and microservices.
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

### 🟢 Node.js Implementation
**Target**: Web backends and desktop applications.
- **Source**: `node/darkstar_crypt.js`
- **Dependency**: Native `crypto` module (Node 19+)

```javascript
import { DarkstarCrypt } from './darkstar_crypt.js';
const crypt = new DarkstarCrypt();
const { encryptedData, reverseKey } = await crypt.encrypt("phrase", "pass");
```

---

## ⌨️ CLI Usage

Both Go and Rust implementations are pre-configured for terminal usage:

```bash
# General Syntax
./darkstar-cli <command> <payload> <password>

# Examples
./darkstar-cli encrypt "my secret" "mypass"
./darkstar-cli test
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
> A **Reverse Key** (base64 encoded mapping) is produced during encryption. This key is **stateless** and must be stored securely alongside the encrypted data to enable decryption.

---

## ⚖️ License
The Darkstar Encryption Suite is released under the **MIT License**.
