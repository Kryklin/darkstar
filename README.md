# Darkstar Security Suite

<p align="center">
  <img src="public/assets/img/logo-white.png" width="400" alt="Darkstar Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.8.1-blue" alt="Version">
  <img src="https://img.shields.io/badge/Angular-v21.0.8-dd0031?logo=angular&logoColor=white" alt="Angular">
  <img src="https://img.shields.io/badge/Electron-v38.2.0-blue?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Go-v1.25.5-00ADD8?logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Rust-2021-000000?logo=rust&logoColor=white" alt="Rust">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Node.js-v19%2B-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/docker-%230db7ed?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

`darkstar` is a defense-grade client-side security tool designed to safeguard sensitive recovery phrases and data. It combines a dynamic, 12-stage obfuscation pipeline with military-grade AES-256 encryption and hardware-bound protection to create a defense-in-depth security layer.

> [!NOTE]
> **Architecture Overview**: Curious how it works? View the [Visual Architecture Guide](DARKSTAR_ARCHITECTURE.md).

> [!TIP]
> **Multi-Language Suite**: Looking to integrate Darkstar into your own backend or tools? Check out the [Multi-Language Encryption Suite](darkstar-encry/README.md) featuring Go, Rust, Python, and Node.js implementations.

## Key Features

- **Secure Vault (New)**: A session-based, zero-knowledge vault for managing secure notes and sensitive metadata.
- **Hardware-Bound Protection**: Utilizes **Electron SafeStorage** (TPM/DPAPI) to cryptographically lock your vault to your specific device, preventing data theft from other machines.
- **Mnemonic Obfuscation Engine**: Multi-protocol support (BIP39, Electrum, SLIP39) with a unique, randomized 12-stage transformation chain for every word.
- **Reverse Key Compression**: High-efficiency binary packing for obfuscation maps, ensuring faster transfers and smaller storage footprints.
- **Structural Steganography**: "Stealth Export" allows you to disguise encrypted data as common system files (.log, .csv, .json) for plausible deniability.
- **V2 Encryption Engine**: Powered by Web Crypto API with **600,000 PBKDF2 iterations** for maximum brute-force resistance.
- **Anti-Forensic Memory**: Strict `Uint8Array` usage with explicit memory zeroing to mitigate sensitive data residency in JavaScript's heap.
- **Premium UI**: A high-fidelity Glassmorphism interface with custom themes and smooth animations.
- **Offline First**: Zero telemetry. All operations occur locally on your device.

## Getting Started

### Installation

```bash
git clone https://github.com/Kryklin/darkstar.git
cd darkstar
npm install
```

### Development

| Command                | Description                             |
| :--------------------- | :-------------------------------------- |
| `npm start`            | Start Angular dev server (Web)          |
| `npm run electron:dev` | Start Electron app with Hot Reloading   |
| `npm run package`      | Build distributable package for your OS |
| `npm run format`       | Standardize codebase using Prettier     |
| `npm test`             | Run unit tests (Karma/Jasmine)          |

## How it Works

`darkstar` employs a "Defense in Depth" strategy:

1.  **Selection**: A pool of 12 obfuscation functions is **shuffled deterministically** based on your password and the word being encrypted.
2.  **Transformation**: The word passes through this unique chain, undergoing 12 layers of structural and entropic changes.
3.  **Encryption**: The resulting high-entropy blob is encapsulated and encrypted using **AES-256-CBC**.
4.  **Hardware Binding**: For the Secure Vault, the encrypted blob is further protected by **Electron SafeStorage**, binding the data to the physical device's security hardware.

This ensures that even if local storage is compromised, the data remains a chaotic, structured mess that cannot be decrypted without your password, your specific hardware, and the unique functional map.

## Authors

**Victor Kane** - [https://github.com/Kryklin](https://github.com/Kryklin)
