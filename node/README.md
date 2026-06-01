[⬅ Back to Main README](../README.md)

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
