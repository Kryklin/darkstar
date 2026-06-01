<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-white.png">
    <img src="../assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>

# D-ASP: Zig Implementation

<p align="left">
  <img src="https://img.shields.io/badge/Zig-F7A41D?style=for-the-badge&logo=zig&logoColor=white" alt="Zig">
</p>

## Overview
This is the Zig implementation of the **ASP Cascade 16 (D-ASP)** engine. It demonstrates Zig's powerful C interop and SIMD capabilities, seamlessly linking to the C engine sources to provide a high-throughput, constant-time wrapper with near zero-overhead.

## Prerequisites
- Zig 0.16.0+

## Build Instructions
```bash
zig build
```

## Usage
The Zig engine matches the standard CLI usage:
```bash
./zig-out/bin/d-asp_zig encrypt <payload> <pk_hex> [--hwid <hex>] [--telemetry]
./zig-out/bin/d-asp_zig decrypt <json_payload> <sk_hex> [--hwid <hex>] [--telemetry]
```

---

<div align="center">

[🏠 Main](../README.md) | [📐 Math Spec](../DASP_CRYPTO_MATH.md) | [⚙️ System Flows](../DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](../DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](../DARKSTAR_CLI_GUIDE.md) | [🔒 Security](../SECURITY.md) | [🤝 Contributing](../CONTRIBUTING.md)

</div>
