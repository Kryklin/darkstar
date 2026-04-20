<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# Darkstar App: Desktop & Mobile Reference

<p align="left">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Angular">
</p>

<p align="left">
  <img src="https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/badge/iOS-000000?style=for-the-badge&logo=ios&logoColor=white" alt="iOS">
  <img src="https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android">
</p>

---

## 🏗️ Architecture Overview

The Darkstar application is a unified security dashboard built using a modern decoupled architecture. It leverages a shared **Angular** frontend that is deployed to native environments via specialized bridges.

### 💻 Desktop Execution (Electron)
The desktop application uses **Electron** to provide a secure, air-gapped-ready environment. The `electron/` source manages native IPC (Inter-Process Communication) and hardware-bound integrity checks.

### 📱 Mobile Execution (Capacitor)
For mobile platforms, **Capacitor** bridges the Angular web views to native Android and iOS activities. Hardware-unique identity binding is maintained across all platforms through the standard D-ASP protocol.

---

## 🚀 Development Workflow

### Prerequisites
- **Node.js**: v19.0.0+
- **Angular CLI**: v21.2.0+
- **CocoaPods** (for iOS development)
- **Android Studio** (for Android development)

### Standard Execution
To launch the application in development mode:
```bash
npm start
```

### Mobile Synchronization
When UI changes are made, they must be synchronized to the native mobile wrappers:
```bash
# Build the web assets and sync with Capacitor
npm run build
npx cap sync
```

### Opening Native IDEs
```bash
npx cap open android
npx cap open ios
```

---

## 📦 Build & Packaging

Darkstar uses **Electron Forge** for desktop distribution and **Capacitor CLI** for mobile.

| Target Platform | Toolchain | Output Format |
| :--- | :--- | :--- |
| **Windows** | Electron Forge | `.exe` (Squirrel / MSI) |
| **macOS** | Electron Forge | `.dmg`, `.zip` |
| **Linux** | Electron Forge | `.deb`, `.rpm` |
| **Android** | Capacitor + Gradle | `.apk`, `.aab` |
| **iOS** | Capacitor + Xcode | `.ipa` |

---

[**&larr; Back to Project Root**](README.md)
