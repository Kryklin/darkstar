# D-KASP V8 (SPNA-Hardened)
The **D-KASP V8** suite is a sovereign post-quantum encryption engine designed for the Darkstar ecosystem, providing bit-perfect interoperability across **Go**, **Rust**, **Python**, and **Node.js**.

- **ML-KEM-1024 (Kyber)**: NIST Level 5 Post-Quantum root of trust.
- **16-Round, 64-Layer SPNA Gauntlet**: Hardened deterministic schedule (Substitution, Permutation, Network, Algebraic) every round.
- **HMAC-Linked Fusion**: Authentication-first protocol providing ML-KEM-linked integrity.
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

# Common Operations
./darkstar keygen                                     # Generate PQ keys
./darkstar encrypt "my mnemonic" <public_key_hex>      # Encrypt (Forces V8)
./darkstar decrypt <json_payload> <rk_b64> <sk_hex>    # Decrypt (Auto-detects V2-V8)
./darkstar test                                       # Run engine self-test
```

---

## 📜 Standard Specification (V8)

D-KASP V8 produces a JSON-encapsulated envelope with a 64-layer gauntlet:
```json
{
  "v": 8,
  "data": "HEX_ENCODED_OBFUSCATED_PAYLOAD",
  "ct": "ML_KEM_ENCAPSULATED_KEY_HEX",
  "mac": "HMAC_SHA256_TAG_HEX"
}
```
> [!IMPORTANT]
> **V8 Gauntlet Schedule**: Every word undergoes 16 rounds of SPNA (Substitution, Permutation, Network, Algebraic) transformations. High-diffusion layers (S-Box, ModMult, GFMult, MatrixHill) are enforced at fixed intervals to ensure maximum statistical entropy and prevent linear cryptanalysis.

---

## ⚖️ License
Released under the **MIT License**.
