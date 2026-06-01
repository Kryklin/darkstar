<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: Node.js Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
</p>

## Overview
This is the Node.js implementation of the **ASP Cascade 16 (D-ASP)** engine. It uses WebAssembly (WASM) generated from the Rust core to achieve near-native performance and constant-time execution inside the V8 JS engine.

## Prerequisites
- Node.js 18+
- npm

## Build Instructions
```bash
npm install
npm run build
```

## Usage
Import the module or use the provided script:
```javascript
const { encrypt, decrypt } = require('./dist/index.js');
```

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
