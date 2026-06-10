<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-white.png">
    <img src="assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](README.md) | [📐 Math Spec](DSPNA_512_CRYPTO_MATH.md) | [⚙️ System Flows](DSPNA_512_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](DSPNA_512_NIST_COMPLIANCE.md) | [💻 CLI Guide](DARKSTAR_CLI_GUIDE.md) | [🔒 Security](SECURITY.md) | [🤝 Contributing](CONTRIBUTING.md)

</div>

# ASP Cascade 16: System Logic & Architectural Flows

This document provides a high-fidelity visual breakdown of the logic flows within the **Darkstar ARX Substitution & Permutation (D-SPNA-512)** protocol. It serves as the primary reference for understanding the cryptographic execution pipeline.

## 1. Identity Binding & HUB Flow

The **Hardware-Unique Blending (HUB)** process prevents "Static State Theft" by ensuring that a shared secret ($SS$) derived from ML-KEM is only valid on the specific machine that originated the transaction.

```mermaid
sequenceDiagram
    participant U as User / OS
    participant K as ML-KEM-1024 Engine
    participant H as HUB (Blender)
    participant G as ASP Cascade 16

    U->>K: Provide Secret + HWID
    K->>K: Decapsulate Shared Secret (SS)
    K->>H: SS (256-bit) + HWID (512-bit)
    Note over H: HKDF-Extract(salt=HWID, IKM=SS)
    H->>H: Derive PRK
    Note over H: HKDF-Expand(PRK, info="dasp-identity-v3")
    H->>H: Derive Root Key (K_root)
    H->>G: Inject K_root into Round 0
```

---

## 2. The ASP Cascade 16 Loop (Static Unrolled)

The core cryptographic engine applies 16 rounds of deterministic transformation on a 256-bit (32-byte) state. It is fully unrolled into an intrinsic-forced execution model.

```mermaid
graph LR
    subgraph "ASP Cascade Round Logic (Static x16)"
    S[Add Round Key] --> P[XOR Round Constant]
    P --> N[Funnel Shift Rotation]
    N --> A[Network Word Shuffle]
    end

    Start((State Block)) --> S
    A --> Loop{Round < 16?}
    Loop -- Yes --> S
    Loop -- No --> End((Keystream Block))
```

### Round Component Details

| Layer            | Operation               | Purpose                       |
| :--------------- | :---------------------- | :---------------------------- |
| **Permutation**  | Left/Right bitwise rotation | Structural diffusion          |
| **Network**      | Butterfly Mixing (Addition) | Cross-lane dependency         |
| **Substitution** | 32-bit bitwise XOR      | Algebraic Non-Linearity (ARX) |
| **Permutation**  | 32-bit Funnel Shift     | Bit-level cascading diffusion |
| **Network**      | SIMD Word Shuffle       | Cross-word diffusion          |

---

## 3. Multi-Language Interoperability Path

D-SPNA-512 achieves "Bit-Perfect" parity. Regardless of the implementation language, the output for any given input is mathematically guaranteed to be identical.

```mermaid
stateDiagram-v2
    [*] --> Client: Reference Input
    Client --> Rust: FFI / IPC Request
    Rust --> ML_KEM: Gen Shared Secret
    ML_KEM --> Rust: Return SS (1024-bit)
    Rust --> SHA3: Hash(SS || HWID)
    SHA3 --> Rust: 512-bit Seed
    Rust --> ASP_Engine: Seed + Payload
    ASP_Engine --> Rust: Ciphertext
    Client --> JSON_Envelope: ASP Cascade 16
    CNative --> JSON_Envelope: ASP Cascade 16
    NodeJS --> JSON_Envelope: ASP Cascade 16
    Client --> JSON_Envelope: ASP Cascade 16
    CUDAGPU --> JSON_Envelope: ASP Cascade 16 (Parallel)

    JSON_Envelope --> InteropSuccess: Bit-Perfect Match
    InteropSuccess --> [*]
```

---

<div align="center">

[🏠 Main](README.md) | [📐 Math Spec](DSPNA_512_CRYPTO_MATH.md) | [⚙️ System Flows](DSPNA_512_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](DSPNA_512_NIST_COMPLIANCE.md) | [💻 CLI Guide](DARKSTAR_CLI_GUIDE.md) | [🔒 Security](SECURITY.md) | [🤝 Contributing](CONTRIBUTING.md)

</div>
