<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../public/assets/img/logo-white.png">
    <img src="../public/assets/img/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

# D-ASP: System Logic & Architectural Flows

[**&larr; Back to D-ASP Suite**](README.md) | [**Mathematical Specification**](DASP_CRYPTO_MATH.md) | [**Project Root**](../README.md)

This document provides a high-fidelity visual breakdown of the logic flows within the **Darkstar Algebraic Substitution & Permutation (D-ASP)** protocol. It serves as the primary reference for understanding the lifecycle of a secret within the Security Enclave.

---

## 1. Global Enclave Lifecycle

The high-level flow from raw user input to secure persistent storage. The enclave ensures that every secret is cryptographically bound to the host hardware before being processed by the SPNA gauntlet.

```mermaid
graph TD
    subgraph "The Security Enclave"
    A[User Input / Secrets] --> B{Hardware-Unique Blending}
    B -- "HWID + OS Entropy" --> C[ML-KEM-1024 Root Key]
    C --> D[D-ASP Gauntlet: 16-Round SPNA]
    D -- "Diffusion & Network Layers" --> E[Encrypted Storage Enclave]
    end
    
    E -- "Multi-Language Interop" --> F[Rust / Go / Node / Python]
```

---

## 2. Identity Binding & HUB Flow

The **Hardware-Unique Blending (HUB)** process prevents "Static State Theft" by ensuring that a shared secret ($SS$) derived from ML-KEM is only valid on the specific machine that originated the transaction.

```mermaid
sequenceDiagram
    participant U as User / OS
    participant K as ML-KEM-1024 Engine
    participant H as HUB (Blender)
    participant G as SPNA Gauntlet

    U->>K: Provide Secret + HWID
    K->>K: Decapsulate Shared Secret (SS)
    K->>H: SS (256-bit) + HWID (512-bit)
    Note over H: SHA256(SS || HWID || salt)
    H->>H: Derive Root Key (K_root)
    H->>G: Inject K_root into Round 0
```

---

## 3. The 16-Round SPNA Gauntlet

The core cryptographic engine applies 16 rounds of deterministic transformation. Each round cascades through four distinct mathematical layers to achieve maximum entropy and bit-diffusion.

```mermaid
graph LR
    subgraph "SPNA Round Logic (Repeats x16)"
    S[S-Box Layer] --> P[Permutation Layer]
    P --> N[MDS Network Layer]
    N --> A[Algebraic ARX Mixing]
    end
    
    Start((K_root)) --> S
    A --> Loop{Round < 16?}
    Loop -- Yes --> S
    Loop -- No --> End((Ciphertext))
```

### Round Component Details
| Layer | Mathematical Operation | Purpose |
| :--- | :--- | :--- |
| **Substitution** | 256-entry Non-linear S-Box | Break linear correlation |
| **Permutation** | 3-Way Columnar Transposition | Cascading diffusion |
| **Network** | MDS Matrix Multiplication (GF2^8) | Maximum Distance Separable diffusion |
| **Algebraic** | ARX (Add-Rotate-XOR) | Complexity against differential analysis |

---

## 4. Multi-Language Interoperability Path

D-ASP achieves "Bit-Perfect" parity. Regardless of the implementation language, the output for any given input is mathematically guaranteed to be identical.

```mermaid
stateDiagram-v2
    [*] --> RustRef: Reference Input
    [*] --> GoNative: Reference Input
    [*] --> NodeJS: Reference Input
    [*] --> Python: Reference Input

    RustRef --> JSON_Envelope: SPNA Gauntlet
    GoNative --> JSON_Envelope: SPNA Gauntlet
    NodeJS --> JSON_Envelope: SPNA Gauntlet
    Python --> JSON_Envelope: SPNA Gauntlet

    JSON_Envelope --> InteropSuccess: Bit-Perfect Match
    InteropSuccess --> [*]
```

---

## 🏗️ Technical Navigation

| Scope | Resource |
| :--- | :--- |
| **Formal Specification** | [**DASP_CRYPTO_MATH.md**](DASP_CRYPTO_MATH.md) |
| **Implementation Details** | [**D-ASP README**](README.md) |
| **Security Guarantees** | [**SECURITY.md**](../SECURITY.md) |
