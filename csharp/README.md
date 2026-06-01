[⬅ Back to Main README](../README.md)

# D-ASP: C# (.NET) Implementation

<p align="left">
  <img src="https://img.shields.io/badge/C%23-.NET-512BD4?style=for-the-badge&logo=dotnet&logoColor=white" alt="C#">
</p>

## Overview
This is the C# (.NET 8) wrapper for the **ASP Cascade 16 (D-ASP)** engine. It uses `P/Invoke` to interoperate directly with the native C compiled DLL (`dasp_kem.dll`), ensuring that .NET consumers benefit from native constant-time execution while maintaining a managed API surface.

## Prerequisites
- .NET 8.0 SDK

## Build Instructions
```bash
dotnet build -c Release
```

## Usage
The C# executable matches the D-ASP universal CLI:
```bash
d-asp_csharp.exe encrypt <payload> <pk_hex> [--hwid <hex>] [--telemetry]
d-asp_csharp.exe decrypt <json_payload> <sk_hex> [--hwid <hex>] [--telemetry]
```
