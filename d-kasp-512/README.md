# D-KASP: Multi-Language Cryptographic Engine Suite

The **D-KASP (Deterministic-KASP)** suite is a sovereign post-quantum encryption engine providing bit-perfect interoperability across **Go**, **Rust**, **Python**, and **Node.js**.

---

## 🛠️ Core Capabilities

- **ML-KEM-1024 (Kyber)**: NIST Level 5 Post-Quantum root of trust.
- **16-Round SPNA Gauntlet**: Hardened deterministic schedule (Substitution, Permutation, Network, Algebraic) every round.
- **HMAC-Linked Fusion**: Authentication-first protocol providing ML-KEM-linked integrity.
- **Hardware Binding**: Optional machine-unique entropy injection ($HWID$).

---

## 🏗️ Cross-Language Implementation Parity

All implementations are designed as **high-performance, standalone sources** to ensure maximum portability and zero external cryptographic dependencies (where possible).

| Language    | Engine Path                | Core Implementation    |
| :---------- | :------------------------- | :--------------------- |
| **Rust**    | `rust/src/main.rs`         | ML-KEM / SPNA Gauntlet |
| **Go**      | `go/main.go`               | ML-KEM / SPNA Gauntlet |
| **Python**  | `python/darkstar_crypt.py` | SPNA Gauntlet          |
| **Node.js** | `node/darkstar_crypt.js`   | SPNA Gauntlet / Bridge |

---

## ⌨️ CLI Usage Standard

All CLI engines share a standardized argument structure for seamless integration.

```bash
# General Syntax
./darkstar [flags] <command> [arguments...]

# Available Commands
encrypt <mnemonic> <pk_hex> [--hwid <hex>]   # Encrypt using D-KASP
decrypt <json_payload> <sk_hex> [--hwid <hex>] # Decrypt using D-KASP
keygen                                       # Generate ML-KEM keypair
test                                         # Run bit-perfect self-test
```

---

## 📜 Exchange Specification

D-KASP utilizes a flattened JSON envelope for universal compatibility:

```json
{
  "data": "<HEX_ENCODED_PAYLOAD>",
  "ct": "<HEX_ENCODED_KEM_CIPHERTEXT>",
  "mac": "<HEX_ENCODED_HMAC_TAG>"
}
```

> [!NOTE]
> **Bit-Parity Guarantee**: For any given input and keys, every engine in this suite is mathematically guaranteed to output identical Hex/JSON byte-streams.

---

## ⚖️ License

Released under the **MIT License**.
