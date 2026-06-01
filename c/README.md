<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: C Implementation

<p align="left">
  <img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=white" alt="C">
</p>

## Overview
This is the C/C++ implementation of the **ASP Cascade 16 (D-ASP)** engine. It offers a highly optimized, constant-time `spna_engine.c` FFI library capable of integrating seamlessly with low-level systems and providing interoperability targets for C# and other high-level wrappers.

## Prerequisites
- MSVC Toolchain (Visual Studio) or compatible `cl.exe` (Windows)
- LLVM / Clang (Alternative for strict C11 compilation)

## Build Instructions
Run the provided batch script to build the main executable and the interoperability DLL:
```cmd
build.bat
```

## Usage
The native C executable conforms to the standard D-ASP CLI interface:
```bash
./dasp encrypt <payload> <pk_hex> [--hwid <hex>] [--telemetry]
./dasp decrypt <json_payload> <sk_hex> [--hwid <hex>] [--telemetry]
./dasp test
```

## Error Codes
- **`2`**: Missing CLI arguments.
- **`3`**: Input file not found.
- **`4`**: JSON parse failure.
- **`5`**: MAC verification or Decapsulation failure.

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
