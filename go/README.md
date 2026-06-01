<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: Go Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
</p>

## Overview
This is the pure Go implementation of the **ASP Cascade 16 (D-ASP)** engine. It is highly optimized and provides standalone cross-platform capability with no CGO dependencies.

## Prerequisites
- Go 1.21+

## Build Instructions
```bash
go build -o d-asp_go.exe main.go
```

## Usage
The Go engine matches the standard CLI usage:
```bash
./d-asp_go encrypt <payload> <pk_hex> [--hwid <hex>] [--telemetry]
./d-asp_go decrypt <json_payload> <sk_hex> [--hwid <hex>] [--telemetry]
```

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
