# D-KASP-512
The **D-KASP-512** suite is a post-quantum encryption engine designed for the Darkstar ecosystem (Core v3.0.0), providing bit-perfect interoperability across **Go**, **Rust**, **Python**, and **Node.js**.

- **ML-KEM-1024 (Kyber)**: NIST Level 5 Post-Quantum root of trust.
- **512-Layer Gauntlet**: Deterministic, non-linear SPN/ARX obfuscation layers.
- **Positional Salting**: Index-based entropy injection ensures unique cipher paths for identical data.

---

## 🛠️ Cross-Language Integration
All implementations are provided as **high-performance, single-file** sources for maximum portability.

| Language  | Source File                | Quick Snippet                                                                 |
| :-------- | :------------------------- | :---------------------------------------------------------------------------- |
| **Node**  | `node/darkstar_crypt.js`   | `crypt.encrypt('phrase', 'pk_hex')`                                           |
| **Go**    | `go/main.go`               | `dc.Encrypt("phrase", "pk_hex")`                                             |
| **Rust**  | `rust/src/main.rs`         | `dc.encrypt("phrase", "pk_hex")`                                             |
| **Python**| `python/darkstar_crypt.py` | `dc.encrypt("secret", "pk_hex")`                                              |

---

## ⌨️ CLI Command Structure

```bash
# General Syntax
./darkstar [flags] <command> [arguments...]

# Common Operations (V5 ML-KEM)
./darkstar keygen                                     # Generate PQ keys
./darkstar encrypt "my mnemonic" <public_key_hex>      # Encrypt
./darkstar decrypt <json_payload> <rk_b64> <sk_hex>    # Decrypt
./darkstar test                                       # Run engine self-test
```

---

## 📜 Standard Specification (V5)

D-KASP-512 (V5) produces a JSON-encapsulated envelope:
```json
{
  "v": 5,
  "data": "SALT(32)NONCE(24)CIPHERTEXT(B64)TAG(32)",
  "ct": "ML_KEM_ENCAPSULATED_KEY_HEX"
}
```
> [!IMPORTANT]
> The **Reverse Key** is packed using a **16-bit Big-Endian** binary format (Base64 encoded) across all implementations to ensure bit-perfect cross-platform alignment.

---

## ⚖️ License
Released under the **MIT License**.

