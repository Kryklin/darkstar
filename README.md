# Darkstar Security Suite

<p align="center">
  <img src="public/assets/img/logo-white.png" width="400" alt="Darkstar Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-blue" alt="Version">
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

`darkstar` is a defense-grade client-side security tool designed to safeguard sensitive recovery phrases, data, and notes. It combines the **D-KASP V8 (SPNA-Hardened) Engine** with **ML-KEM-1024** (Kyber) and **AES-256-GCM** for industry-leading Quantum Resistance.

---

## 🛡️ Core Security Features

| Category             | Key Capabilities                                                                 |
| :------------------- | :------------------------------------------------------------------------------- |
| **PQC Encryption**   | D-KASP V8 engine with ML-KEM-1024, AES-256-GCM, and Positional Salting.             |
| **Advanced Privacy** | Air-Gapped QR Transfer, Audio Steganography (WAV), and Anti-Forensic Memory.     |
| **Vault Management** | Zero-knowledge Secure Vault, Identity Binding, and Automated Scheduled Backups.  |
| **Access Control**   | Biometric Unlock (FaceID/TouchID), YubiKey Support (WebAuthn), and TOTP 2FA.     |
| **Integrity**        | Application Anti-Tamper Checks and mathematical Time-Lock Encryption (VDF).      |
| **Modern UX**        | Premium V3 Dashboard with flat navigation, stateful taskbar, and persistent vault view. |

---

## 🚀 Getting Started

### Installation & Development
```bash
git clone https://github.com/Kryklin/darkstar.git
cd darkstar
npm install
npm start # Start interactive UI
```

## 🏗️ Technical Architecture

1.  **Identity Generation**: Unique Master Key and Cryptographic Identity generated upon vault creation.
2.  **Obfuscation Pipeline**: Hardened 16-round, 64-layer SPNA gauntlet driven by index-salted entropy.
3.  **Layered Encryption**: ML-KEM-1024 (Kyber) and AES-256-GCM encapsulation.
4.  **Hardware Binding**: OS-level protection via Electron SafeStorage and Signature Key binding.
5.  **V3 Workflow**: Stateful navigation with real-time vault status and non-dismissible note management.

> [!NOTE]
> View the [Visual Architecture Guide](DARKSTAR_ARCHITECTURE.md) or the [Multi-Language Suite](d-kasp-512/README.md) for more technical details.

## Authors
**Victor Kane** - [GitHub](https://github.com/Kryklin)

