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
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
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
| `interop` | **Interop Benchmark**   | `npm run test:interop`  | Verifies bit-perfect parity across all language engines (including CUDA).                   |
| `kat`     | **KAT Verification**    | `npm run test:kat`      | Runs the Known Answer Test suite (NIST Parity) across all engines, including GPU execution. |
| `gen-kat` | **Generate KAT Data**   | `npm run test:gen-kat`  | Re-generates standard, long, and bound KAT vectors using the reference engine.              |

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
| `check-env`   | **Dev Environment Check** | Custom Script           | Verifies the installation of C, Rust toolchains.                          |
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

## 💻 Native Engine CLI Usage

The core cryptographic engines (`rust`, `c`, `cuda`) share a unified CLI API that supports three modes of data ingestion for both `encrypt` and `decrypt` operations.

> **Note:** The executable name will differ per engine (e.g. `d-asp.exe`, `dasp.exe`, `d-asp_cuda.exe`). The examples below use `<engine_exe>`.

### 1. Single Payload (Raw String)
Ideal for small, inline strings or environmental variables.

```bash
# Encrypting a short string
<engine_exe> encrypt "my secret payload" <public_key_hex> [--hwid <hex>]

# Decrypting an inline JSON payload
<engine_exe> decrypt '{"iv":"...","ct":"..."}' <secret_key_hex> [--hwid <hex>]
```

### 2. File Parameters (`@file`)
By prefixing an argument with `@`, the engine will dynamically read the target file's contents into memory. This is highly recommended for large payloads or securely storing keys on disk instead of passing them via the shell history.

```bash
# Encrypt a payload from a file using a public key from another file
<engine_exe> encrypt @payload.txt @public_key.hex [--hwid <hex>]

# Decrypt using a secret key file
<engine_exe> decrypt @output.json @secret_key.hex [--hwid <hex>]
```

### 3. High-Throughput Streaming (STDIN/STDOUT)
For massive multi-gigabyte payloads or pipeline chaining, use the `stream-encrypt` and `stream-decrypt` commands. These commands bypass terminal argument limitations and stream data directly through standard IO pipes.

```bash
# Stream a large file directly into the encryption engine and pipe the JSON output
cat massive_file.bin | <engine_exe> stream-encrypt @public_key.hex [--hwid <hex>] > output.json

# Stream the JSON back into decryption and pipe out the raw bytes
cat output.json | <engine_exe> stream-decrypt @secret_key.hex [--hwid <hex>] > restored_file.bin
```

---

<div align="center">

[🏠 Main](README.md) | [📐 Math Spec](DASP_CRYPTO_MATH.md) | [⚙️ System Flows](DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](DARKSTAR_CLI_GUIDE.md) | [🔒 Security](SECURITY.md) | [🤝 Contributing](CONTRIBUTING.md)

</div>
