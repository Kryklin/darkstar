# Darkstar Security Suite

<p align="center">
  <img src="public/assets/img/logo-white.png" width="400" alt="Darkstar Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.9.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/Angular-v21.0.8-dd0031?logo=angular&logoColor=white" alt="Angular">
  <img src="https://img.shields.io/badge/Electron-v38.2.0-blue?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Tor-P2P-7D4698?logo=tor-browser&logoColor=white" alt="Tor Network">
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-v1.25.5-00ADD8?logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Rust-2021-000000?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Node.js-v19%2B-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

`darkstar` is a defense-grade client-side security tool designed to safeguard sensitive recovery phrases, data, and communications. It combines a dynamic, 12-stage obfuscation pipeline with military-grade AES-256 encryption and a decentralized, anonymous P2P messaging layer.

> [!NOTE]
> **Architecture Overview**: Curious how it works? View the [Visual Architecture Guide](DARKSTAR_ARCHITECTURE.md).

> [!TIP]
> **Multi-Language Suite**: Looking to integrate Darkstar into your own backend or tools? Check out the [Multi-Language Encryption Suite](darkstar-encry/README.md) featuring Go, Rust, Python, and Node.js implementations.

## Key Features

- **Anonymous P2P Messaging (New)**: A decentralized messaging system running over the **Tor Network**. Messages are end-to-end signed using your vault's cryptographic identity.
- **Cryptographic Identity (New)**: Auto-generated ECDSA P-256 keypairs securely stored in your vault. Serves as your digital signature for verifiable communication.
- **Secure Vault**: A session-based, zero-knowledge vault for managing secure notes and sensitive metadata with multi-layered encryption.
- **Hardware-Bound Protection**: Utilizes **Electron SafeStorage** (TPM/DPAPI) to cryptographically lock your vault to your specific device, preventing data theft from other machines.
- **Mnemonic Obfuscation Engine**: Multi-protocol support (BIP39, Electrum, SLIP39) with a unique, randomized 12-stage transformation chain for every word.
- **Structural Steganography**: "Stealth Export" allows you to disguise encrypted data as common system files (.log, .csv, .json) for plausible deniability.
- **V2 Encryption Engine**: Powered by Web Crypto API with **600,000 PBKDF2 iterations** for maximum brute-force resistance.
- **Anti-Forensic Memory**: Strict `Uint8Array` usage with explicit memory zeroing. The P2P service automatically performs an emergency shutdown if the vault is locked.
- **Windows Hello & Biometrics (New)**: Unlock your vault primarily using platform biometrics (TouchID, FaceID) or **Hardware Keys (YubiKey)** via WebAuthn.
- **Audio Steganography (New)**: Embed encrypted data into WAV audio files using LSB encoding. Supports uploading custom cover audio or generating white noise.
- **P2P "DarkDrop" (New)**: Securely drag-and-drop files to peers over Tor. Files are chunked, encrypted, and streamed anonymously.
- **Reputation System (New)**: A localized "Web of Trust" allowing you to rate peers and visually identify trusted contacts.
- **Premium UI**: A high-fidelity Glassmorphism interface with custom themes and smooth animations.
- **Offline First**: Zero telemetry. All core encryption operations occur locally on your device.

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
| `npm start`            | Start the application (Electron + Angular) |

## How it Works

`darkstar` employs a "Defense in Depth" strategy:

1.  **Identity Generation**: Upon vault creation, a unique **ECDSA P-256** keypair is generated. The private key never leaves your encrypted vault.
2.  **Obfuscation Pipeline**: A pool of 12 obfuscation functions is **shuffled deterministically** based on your password to transform sensitive data.
3.  **Layered Encryption**: The data is encapsulated and encrypted using **AES-256-CBC** + **HMAC-SHA256**.
4.  **Hardware Binding**: The encrypted blob is further protected by **Electron SafeStorage**, binding the data to the physical device's security hardware.
5.  **Verified Communication**: Outgoing messages are signed with your private key. Incoming messages are verified against the sender's public key, ensuring authentic, tamper-proof communication over Tor.

This ensures that your data is secure at rest, in transit, and in use.

## Authors

**Victor Kane** - [https://github.com/Kryklin](https://github.com/Kryklin)
