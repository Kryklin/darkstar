<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" alt="Darkstar Logo" width="220">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.7.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/Angular-v20.3.0-dd0031?logo=angular" alt="Angular"/>
  <img src="https://img.shields.io/badge/Angular%20Material-v20.2.5-blue?logo=angular" alt="Angular Material"/>
  <img src="https://img.shields.io/badge/Electron-v38.2.0-blue?logo=electron" alt="Electron"/>
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

`darkstar` is a defense-grade client-side security tool designed to safeguard your Bitcoin wallet's recovery phrase. It combines a dynamic, 12-stage obfuscation pipeline with military-grade AES-256 encryption to protect your digital assets.

> [!NOTE]
> **Architecture Overview**: Curious how it works? View the [Visual Architecture Guide](DARKSTAR_ARCHITECTURE.md).

> [!TIP]
> **Multi-Language Suite**: Looking to integrate Darkstar into your own backend or tools? Check out the [Multi-Language Encryption Suite](darkstar-encry/README.md) featuring Go, Rust, Python, and Node.js implementations.

## Key Features

- **Multi-Protocol Support**: BIP39, Electrum (Legacy/V2), and SLIP39.
- **Dynamic Obfuscation**: A unique, randomized 12-stage transformation chain for *every single word*, determined by the password + data itself.
- **V2 Encryption Engine**: Powered by Web Crypto API with **600,000 PBKDF2 iterations** for maximum brute-force resistance.
- **Anti-Forensic Memory**: Sensitive operations use zeroed-out `Uint8Array` buffers to prevent memory residency.
- **Modern UI**: A premium, responsive Glassmorphism interface with light/dark theme support.
- **Offline First**: Zero telemetry. All operations occur locally on your device.

## Getting Started

### Installation

```bash
git clone https://github.com/Kryklin/darkstar.git
cd darkstar
npm install
```

### Development

| Command | Description |
| :--- | :--- |
| `npm start` | Start Angular dev server (Web) |
| `npm run electron:dev` | Start Electron app with Hot Reloading |
| `npm run make` | Build distributable package for your OS |
| `npm test` | Run unit tests (Karma/Jasmine) |

## How it Works

`darkstar` employs a "Defense in Depth" strategy:

1.  **Selection**: A pool of 12 obfuscation functions is **shuffled deterministically** based on your password and the word being encrypted.
2.  **Transformation**: The word passes through this unique chain, undergoing 12 layers of structural and entropic changes (Binary conversion, Ciphers, Bitwise XOR, etc.).
3.  **Encryption**: The resulting high-entropy blob is encapsulated and encrypted using **AES-256-CBC**.
4.  **Keying**: A "Reverse Key" map is generated to track the unique shuffle order, which is required alongside the password to reverse the process.

This ensures that even if the AES layer were hypothetically bypassed, the underlying data remains a chaotic, structured mess without the specific function map.

## Authors

**Victor Kane** - [https://github.com/Kryklin](https://github.com/Kryklin)
