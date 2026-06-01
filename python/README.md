<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: Python Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
</p>

## Overview
This is the Python 3 implementation of the **ASP Cascade 16 (D-ASP)** engine. It uses the `wasmtime` runtime to execute WebAssembly (WASM) compiled from the core Rust logic, guaranteeing constant-time execution while keeping a pythonic interface.

## Prerequisites
- Python 3.8+
- `wasmtime` Python package

## Build Instructions
```bash
pip install -r requirements.txt
python build.py
```

## Usage
Run the engine via the CLI entrypoint:
```bash
python dasp.py encrypt <payload> <pk_hex> [--hwid <hex>] [--telemetry]
python dasp.py decrypt <json_payload> <sk_hex> [--hwid <hex>] [--telemetry]
```

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
