<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/img/logo-white.png">
    <img src="public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# Darkstar Interactive CLI: Developer Dashboard

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Inquirer.js-000000?style=for-the-badge&logo=javascript&logoColor=white" alt="Inquirer">
  <img src="https://img.shields.io/badge/Chalk-white?style=for-the-badge&logo=javascript&logoColor=black" alt="Chalk">
</p>

The Darkstar project includes a terminal-based interactive dashboard to manage all development, testing, and release operations from a single interface. Use this tool as the primary entry point for managing the enclave.

---

## 🚀 Getting Started

The interactive CLI is mapped to the standard `npm start` command.

```bash
# Launch the dashboard
npm start
```

### Prerequisites
- **Node.js**: v19.0.0+ (required for ESM dynamic imports used in the CLI).
- **GitHub Token**: Required for external releases (see [Environment Configuration](#environment-configuration)).

---

## 🛠️ Operations Breakdown

### Development
Operations used during local feature development and engine synchronization.

| Option | Display Name | Command Executed | Description |
| :--- | :--- | :--- | :--- |
| `dev` | **Run Dev Environment** | `ng serve` + `electron` | Launches Angular and Electron concurrently with live reload. |
| `lint` | **Lint Code** | `ng lint` | Executes ESLint across the TypeScript/Angular source. |
| `karma` | **Run Unit Tests** | `ng test ...` | Runs Angular unit tests in Headless Chrome. |
| `interop`| **Interop Benchmark** | `verify_interop.py` | Verifies bit-perfect parity across all language engines. |
| `kat` | **KAT Verification** | `verify_kat.py` | Runs the Known Answer Test suite (NIST Parity). |

### Mobile (Capacitor)
Tools for bridging the core application to Android and iOS runtimes.

| Option | Display Name | Command Executed | Description |
| :--- | :--- | :--- | :--- |
| `cap:sync` | **Sync Mobile Assets** | `npx cap sync` | Builds the web bundle and syncs it to native mobile activities. |
| `cap:open:android` | **Open Android** | `npx cap open android` | Launches the current project in Android Studio. |
| `cap:open:ios` | **Open Xcode** | `npx cap open ios` | Launches the current project in Xcode. |

### Release & Packaging
Production-grade deployment tasks.

| Option | Display Name | Command Executed | Description |
| :--- | :--- | :--- | :--- |
| `build` | **Build Production** | `ng build ...` | Compiles a production-hardened web and electron bundle. |
| `package`| **Package App** | `forge package` | Generates native bundles (Squirrel, DMG, DEB, RPM). |
| `publish`| **Publish Release** | `forge publish` | Uploads the current build to GitHub Releases. |

---

## ⚡ Automated Pipelines
The **"Run All"** option executes the full release sequence in a single automation loop:
1.  **Lint** (Security & Style)
2.  **Angular Tests** (Headless Unit Tests)
3.  **Interop Tests** (Cross-Language Parity)
4.  **Production Build** (D-ASP Integrity Generation)
5.  **GitHub Publication** (Remote Deployment)

---

## 🔑 Environment Configuration

For operations requiring remote connectivity (like `publish`), create a `.env` file in the project root:

```env
# .env (Place in root directory)
GITHUB_TOKEN=your_personal_access_token_here
```

> [!WARNING]
> Never commit your `.env` file to version control. It is explicitly ignored by our [**.gitignore**](.gitignore).

---

[**&larr; Back to Project Root**](README.md)
