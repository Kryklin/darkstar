<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-white.png">
    <img src="assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](README.md) | [📐 Math Spec](DASP_CRYPTO_MATH.md) | [⚙️ System Flows](DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](DARKSTAR_CLI_GUIDE.md) | [🔒 Security](SECURITY.md) | [🤝 Contributing](CONTRIBUTING.md)

</div>

# Darkstar Interactive CLI: Developer Dashboard

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Inquirer.js-000000?style=for-the-badge&logo=javascript&logoColor=white" alt="Inquirer">
  <img src="https://img.shields.io/badge/Chalk-white?style=for-the-badge&logo=javascript&logoColor=black" alt="Chalk">
</p>

The Darkstar project includes a terminal-based interactive dashboard to manage all development, testing, and release operations from a single interface. Use this tool as the primary entry point for managing the cryptographic engines.

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

### Testing & Benchmarking

Operations used to verify parity and execution times across all languages.

| Option    | Display Name            | Command Executed        | Description                                                                                 |
| :-------- | :---------------------- | :---------------------- | :------------------------------------------------------------------------------------------ |
| `interop` | **Interop Benchmark**   | `verify_interop.py`     | Verifies bit-perfect parity across all language engines (including CUDA).                   |
| `kat`     | **KAT Verification**    | `verify_kat.py`         | Runs the Known Answer Test suite (NIST Parity) across all engines, including GPU execution. |
| `gen-kat` | **Generate KAT Data**   | `gen_kat_vectors.py`    | Re-generates standard, long, and bound KAT vectors using the reference engine.              |

### Build & Compilation

Production-grade compilation tasks.

| Option          | Display Name         | Command Executed   | Description                                             |
| :-------------- | :------------------- | :----------------- | :------------------------------------------------------ |
| `build:engines` | **Build All Engines**| `npm run build:*`  | Compiles native binaries and WASM for all languages.    |
| `lint:engines`  | **Lint Code**        | `npm run lint:*`   | Executes formatters and linters across implementations. |

### System

System-level diagnostic and headless verification utilities.

| Option        | Display Name              | Command Executed        | Description                                                                        |
| :------------ | :------------------------ | :---------------------- | :--------------------------------------------------------------------------------- |
| `check-env`   | **Dev Environment Check** | Custom Script           | Verifies the installation of C, Rust, Go, and Python compilers.                    |
| `docker-test` | **Headless Docker Test**  | `docker compose ... up` | Orchestrates a standalone Docker Compose matrix to test language engines off-host. |

---

## ⚡ Automated Pipelines

The **"Run All"** option executes the full release sequence in a single automation loop:

1.  **Lint** (Security & Style)
2.  **Interop Tests** (Cross-Language Parity)
3.  **KAT Tests** (NIST Vectors Validation)
4.  **Production Build** (Compilation of Native Executables)

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

---

<div align="center">

[🏠 Main](README.md) | [📐 Math Spec](DASP_CRYPTO_MATH.md) | [⚙️ System Flows](DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](DARKSTAR_CLI_GUIDE.md) | [🔒 Security](SECURITY.md) | [🤝 Contributing](CONTRIBUTING.md)

</div>
