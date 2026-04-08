# @kryklin/darkstar-crypt-node

> **Darkstar V5 (D-KASP-512) Post-Quantum Encryption - Node.js**

A high-performance implementation of the D-KASP-512 protocol for Node.js. Optimized for backend systems and desktop applications requiring ML-KEM-1024 security.

## 🛡️ Security Features

- **ML-KEM-1024 (Kyber)**: NIST FIPS 203 root-of-trust.
- **D-KASP-512 Obfuscation**: 512-layer non-linear gauntlet with index-salted entropy.
- **AES-256-GCM**: Authenticated encryption.
- **Native Performance**: Leverages the Node.js `crypto` module.

## 🚀 Installation

```bash
npm install @kryklin/darkstar-crypt-node
```

## 💻 Usage

### Library Usage

```javascript
import { DarkstarCrypt } from '@kryklin/darkstar-crypt-node';

const crypt = new DarkstarCrypt();

// Encrypt (V5 requires Public Key Hex)
const { encryptedData, reverseKey } = await crypt.encrypt('secret', 'pk_hex');

// Decrypt (V5 requires JSON, Reverse Key, and Private Key Hex)
const decrypted = await crypt.decrypt(encryptedData, reverseKey, 'sk_hex');
```

---

## 📜 Standard Format (V5)

Standard output is a JSON-encapsulated envelope:

```json
{
  "v": 5,
  "data": "SALT(32)NONCE(24)CIPHERTEXT(B64)TAG(32)",
  "ct": "ML_KEM_ENCAPSULATED_KEY_HEX"
}
```

## ⚖️ License
MIT © Victor Kane

