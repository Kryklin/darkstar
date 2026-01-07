# @kryklin/darkstar-crypt-node

> **Darkstar V2 Encryption Protocol - Node.js Implementation**

A high-performance, standalone implementation of the Darkstar V2 security protocol for Node.js. Designed for web backends and desktop applications requiring defense-in-depth for sensitive mnemonic assets.

## 🛡️ Security Features

- **Dynamic Obfuscation Pool**: 12-stage transformation pipeline seeded by password and data.
- **AES-256-CBC**: Encapsulated with 600,000 PBKDF2 iterations.
- **Stateless Reversal**: Requires a "Reverse Key" produced during encryption for decryption.
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

// Encrypt
const { encryptedData, reverseKey } = await crypt.encrypt("my secret phrase", "password123");
console.log('Encrypted:', encryptedData);
console.log('Reverse Key:', reverseKey);

// Decrypt
const decrypted = await crypt.decrypt(encryptedData, "password123", reverseKey);
console.log('Decrypted:', decrypted);
```

### CLI Usage

The package includes a CLI tool that can be run via `npx`.

```bash
# Encrypt
npx darkstar-crypt encrypt "secret message" "password"

# Decrypt
npx darkstar-crypt decrypt '{"v":2,"data":"..."}' "password" "REVERSE_KEY_B64"

# Run internal tests
npx darkstar-crypt test
```

## 📜 Data Format

Standard output is a JSON-encapsulated object:

```json
{
  "v": 2,
  "data": "SALT(32)IV(32)CIPHERTEXT(B64)"
}
```

> [!IMPORTANT]
> The **Reverse Key** is essential for decryption. It must be stored securely alongside the encrypted data.

## ⚖️ License

MIT © Victor Kane
