[⬅ Back to Main README](../README.md)

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
