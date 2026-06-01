[⬅ Back to Main README](../README.md)

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
