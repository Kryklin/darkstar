# Darkstar Security Suite

<p align="center">
  <img src="public/assets/img/logo-white.png" width="400" alt="Darkstar Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/Angular-v21.0.8-dd0031?logo=angular&logoColor=white" alt="Angular">
  <img src="https://img.shields.io/badge/Electron-v38.2.0-blue?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/TypeScript-v5.9.2-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Capacitor-v8.1-119EFF?logo=capacitor&logoColor=white" alt="Capacitor">
  <img src="https://img.shields.io/badge/Android-Native-3DDC84?logo=android&logoColor=white" alt="Android">
  <img src="https://img.shields.io/badge/iOS-Native-000000?logo=apple&logoColor=white" alt="iOS">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-v1.25.5-00ADD8?logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Rust-2021-000000?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Node.js-v19%2B-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

`darkstar` is a defense-grade client-side security tool designed to safeguard sensitive recovery phrases, data, and notes. It combines a dynamic, **V3 Obfuscation Engine** with military-grade **AES-256-GCM** authenticated encryption.

> [!NOTE]
> **Architecture Overview**: Curious how it works? View the [Visual Architecture Guide](DARKSTAR_ARCHITECTURE.md).

> [!TIP]
> **Multi-Language Suite**: Looking to integrate Darkstar into your own backend or tools? Check out the [Multi-Language Encryption Suite](darkstar-encry/README.md) featuring Go, Rust, Python, and Node.js implementations.

## Key Features

- **Anti-Tamper Integrity Checks**: Cryptographic verification of the application payload on startup prevents malicious modifications or supply-chain injection.
- **Air-Gapped QR Protocol**: Optically transmit and receive AES-encrypted payloads directly over webcam between isolated laptops and mobile devices.
- **Capacitor Mobile Native**: Full cross-platform support. Darkstar compiles into native Android (APK) and iOS (IPA) apps while sharing 100% of the cryptographic logic.
- **Time-Lock Encryption**: Secure notes can be mathematically locked using a Verifiable Delay Function (VDF), guaranteeing they remain encrypted for a predefined temporal computation period.
- **Secure Vault**: A session-based, zero-knowledge vault for managing secure notes and sensitive metadata with multi-layered encryption.
- **Vault Signature Binding (New)**: Cryptographically bind your data to your specific Vault Identity. Decryption is only possible when authenticated with the same cryptographic signature.
- **Identity Backup & Recovery (New)**: Securely export and import your full Vault Identity (JSON) to ensure access to bound data across devices or after a vault reset.
- **V3 Encryption Engine (Advanced)**: Powered by Web Crypto API with **AES-256-GCM** and **ChaCha20-based PRNG**. Verified cross-language interoperability (Go, Rust, Python, Node).
- **Dynamic Deterministic Cycles**: Obfuscation depth scales intelligently (12-64 layers) based on data entropy, replacing the legacy fixed-depth model.
- **Anti-Forensic Memory**: Strict `Uint8Array` usage with explicit memory zeroing. The P2P service automatically performs an emergency shutdown if the vault is locked.
- **Windows Hello & Biometrics**: Unlock your vault primarily using platform biometrics (TouchID, FaceID) or **Hardware Keys (YubiKey)** via WebAuthn.
- **Audio Steganography (New)**: Embed encrypted data into WAV audio files using LSB encoding. Supports uploading custom cover audio or generating white noise.

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

| Command                    | Description                                |
| :------------------------- | :----------------------------------------- |
| `npm start`                | Start the interactive pipeline (Menu UI)   |
| `npm run cap:sync`         | Sync Web assets to Android/iOS platforms   |
| `npm run cap:open:ios`     | Open the iOS project in Xcode              |
| `npm run cap:open:android` | Open the Android project in Android Studio |

## How it Works

`darkstar` employs a "Defense in Depth" strategy:

1.  **Identity Generation**: Upon vault creation, a unique Master Key and Cryptographic Identity are generated.
2.  **Obfuscation Pipeline**: A gauntlet of obfuscation functions is **shuffled deterministically** based on your password, applying 12-64 layers of transformation.
3.  **Layered Encryption**: The data is encapsulated and encrypted using **AES-256-GCM** (V3) for verified authenticity and confidentiality.
4.  **Hardware & Identity Binding**: Payloads can be further protected by **Electron SafeStorage** and bound to the vault's unique **Signature Key**.
5.  **Verified Integrity**: The Electron application hashes its own JavaScript code upon initialization to detect any local malware tampering.

This ensures that your data is secure at rest, in transit, and in use.

## Authors

**Victor Kane** - [https://github.com/Kryklin](https://github.com/Kryklin)
