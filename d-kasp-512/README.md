# D-KASP-512

**D-KASP-512** is the definitive high-performance, post-quantum encryption suite for the Darkstar ecosystem. It pins security to the highest available lattice-based standards while maintaining bit-perfect interoperability across **Go**, **Rust**, **Python**, and **Node.js**.

The name **D-KASP-512** reflects its technical depth:
* **D**: Darkstar (The ecosystem/origin)
* **K**: Kyber-1024 (ML-KEM-1024 / NIST Level 5 root of trust)
* **A**: Augmented (Post-quantum layer beyond standard wrapping)
* **S**: Sequential (Deterministic path-logic for each word)
* **P**: Permutation (512-layer SPN/ARX gauntlet)
* **512**: Permutation Depth (The number of non-linear obfuscation layers)

---

The suite provides bit-perfect interoperability across all supported languages and protocol versions (V1, V2, V3, V4, and V5/D-KASP).

---

## 🛡️ Security Architecture

D-KASP-512 (V5) employs a multi-layered post-quantum security model that fundamentally differs from standard "encrypt-and-store" approaches:

1.  **512-Layer SPN/ARX Gauntlet**: Data passes through up to **512 non-linear** Substitution-Permutation Network and Add-Rotate-XOR primitives.
2.  **Positional Salting (Hardened V5)**: Word index injection into seeding logic. This ensures identical words (e.g., "apple") produce unique cipher-strengths at different positions.
3.  **ML-KEM-1024 (Kyber)**: Core asymmetric security anchored by NIST FIPS 203 (Kyber-1024).
4.  **Military-Grade AES-GCM**: High-entropy blobs are encapsulated and encrypted using **AES-256-GCM**.
5.  **16-bit Big-Endian Binary Protocol**: Reverse keys are packed using a high-fidelity 16-bit header system.

| Feature                 | Description                                                       |
| :---------------------- | :---------------------------------------------------------------- |
| **V5 Hardened Standard**| **Final standard** for D-KASP-512 with positional salting.        |
| **PQ Root of Trust**    | V5 uses ML-KEM-1024 (Kyber) for post-quantum key encapsulation.   |
| **AEAD Authentication** | V3/V4/V5 uses AES-GCM to provide built-in integrity and authenticity. |
| **SPN/ARX Primitives**  | Uses 12 non-linear transformations for cryptographic diffusion.   |
| **Consolidated Source** | Single-file implementations for Go, Rust, Python, and Node.js.    |
| **Interop Matrix**      | **Bit-perfect matching** across all 4 supported languages.        |
| **Backward Compat**     | Seamlessly decrypts V1, V2, V3, and V4 legacy payloads.           |

---

## 🚀 Integration Guide

The Darkstar Encryption Suite is distributed as high-performance, single-file implementations for maximum portability.

### 🟢 Node.js Implementation
**Target**: Web backends and distributed desktop applications.
- **Source**: `node/darkstar_crypt.js` (Single File)
- **Docker**: `docker build -t darkstar-node ./node`

**Integration Snippet**:
```javascript
import { DarkstarCrypt } from './darkstar_crypt.js';
const crypt = new DarkstarCrypt();
const { encryptedData, reverseKey } = await crypt.encrypt('mnemonic', 'pk_hex', 5); // Version 5
```

### 🔷 Go Implementation
**Target**: Performance critical backends and cloud microservices.
- **Source**: `go/main.go` (Single File)
- **Docker**: `docker build -t darkstar-go ./go`

**Integration Snippet**:
```go
// Direct integration from go/main.go
dc := NewDarkstarCrypt()
result, _ := dc.Encrypt("phrase", "pk_hex", 5) // Version 5
```

### 🦀 Rust Implementation
**Target**: System-level integration and high-security crates (Safe Rust).
- **Source**: `rust/src/main.rs` (Single File)
- **Docker**: `docker build -t darkstar-rust ./rust`

**Integration Snippet**:
```rust
let dc = DarkstarCrypt::new();
let json_output = dc.encrypt("phrase", "pk_hex", 5); // Version 5
```

### 🐍 Python Implementation
**Target**: Data science, security scripting, and rapid prototyping.
- **Source**: `python/darkstar_crypt.py` (Single File)
- **Dependency**: `cryptography`, `pqcrypto`

**Integration Snippet**:
```python
from darkstar_crypt import DarkstarCrypt
dc = DarkstarCrypt()
# V5 Encryption (Kyber Root of Trust)
encrypted = dc.encrypt("secret", "pk_hex", version=5)
```

---

## ⌨️ CLI Usage

Standard standalone binaries are provided for Go, Rust, Node.js, and Python implementations.

### Command Structure
```bash
# General Syntax
./darkstar [flags] <command> [arguments...]

# Flags
# -v, --v <1-5>       D-KASP Protocol Version (default: 5)
# -f, --format <fmt>  Output format: json|csv|text
# -c, --core <type>   Encryption core: aes|arx

# V5 ML-KEM Key Generation
./darkstar keygen

# V5 Encryption (Requires Public Key)
./darkstar -v 5 encrypt "my mnemonic" <pk_hex>

# V5 Decryption (Requires Private Key)
./darkstar -v 5 decrypt <payload_json> <reverse_key_b64> <sk_hex>

# V5 Self-Test
./darkstar -v 5 test
```

---

## 📜 Data Format Specification

V5 output uses a JSON-encapsulated structure containing the encapsulated ciphertext (`ct`) required for ML-KEM decapsulation.

### V5 Payload (D-KASP-512 Standard)
```json
{
  "v": 5,
  "data": "SALT(32)NONCE(24)CIPHERTEXT(B64)TAG(32)",
  "ct": "ML_KEM_CIPHERTEXT_HEX"
}
```

### V4 Payload
```json
{
  "v": 4,
  "data": "NONCE(12)CIPHERTEXT(B64)TAG(16)"
}
```

> [!IMPORTANT]
> The **Reverse Key** is packed using a **16-bit Big-Endian** binary format (Base64 encoded) across all implementations for V3, V4, and V5. This ensures bit-perfect alignment for high-depth gauntlets.

---

## ⚖️ License

The Darkstar Encryption Suite is released under the **MIT License**.
