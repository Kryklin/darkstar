# @kryklin/darkstar-crypt-node

> **Darkstar V8 (D-KASP) Post-Quantum Encryption - Node.js**

A high-performance implementation of the D-KASP V8 protocol for Node.js. Optimized for backend systems and desktop applications requiring ML-KEM-1024 security and the 16-round SPNA gauntlet.

## 🛡️ Security Features

- **ML-KEM-1024 (Kyber)**: NIST FIPS 203 root-of-trust.
- **D-KASP V8 SPNA**: 16-round, 64-layer non-linear gauntlet with index-salted entropy.
- **HMAC-Linked Fusion**: Integrated authentication for payload integrity.
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

// Encrypt (V8 requires Public Key Hex)
const { encryptedData, reverseKey } = await crypt.encrypt('secret', 'pk_hex');

// Decrypt (V8 requires JSON, Reverse Key, and Private Key Hex)
const decrypted = await crypt.decrypt(encryptedData, reverseKey, 'sk_hex');
```

---

## 📜 Standard Format (V8)

Standard output is a JSON-encapsulated envelope:

```json
{
  "v": 8,
  "data": "HEX_ENCODED_OBFUSCATED_PAYLOAD",
  "ct": "ML_KEM_ENCAPSULATED_KEY_HEX",
  "mac": "HMAC_SHA256_TAG_HEX"
}
```

## ⚖️ License

MIT © Victor Kane
