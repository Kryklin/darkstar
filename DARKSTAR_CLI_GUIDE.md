# D-SPNA-512 CLI Guide

The D-SPNA-512 Command Line Interface allows for rapid testing, benchmarking, and execution of the post-quantum envelope.

## Usage
`d-spna-512 [OPTIONS]`

## Commands
- `--encrypt <plaintext> <pk_hex>`: Encrypts a string using the provided ML-KEM-1024 public key.
- `--decrypt <payload> <sk_hex>`: Decrypts a payload using the corresponding ML-KEM-1024 secret key.
- `--keygen`: Generates a new ML-KEM-1024 keypair (PK/SK).
- `--benchmark`: Runs a high-performance throughput test utilizing the AVX-512, AVX2, or NEON pipelines.

*Note: The CLI is currently available in the Rust and C implementations.*
