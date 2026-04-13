# D-KASP: Mathematical & Systems Specification

This document provides a formal technical breakdown of the **Deterministic-KASP (D-KASP)** cryptographic protocol. D-KASP is designed for high-diffusion data obfuscation and post-quantum identity binding.

---

## 1. Post-Quantum Trust Anchor (ML-KEM-1024)

D-KASP utilizes **ML-KEM-1024** (Kyber-1024) as its primary root of trust. ML-KEM is a lattice-based key encapsulation mechanism standardized in NIST FIPS 203.

- **Security Level**: NIST Level 5 (256-bit security parity).
- **Core Mechanism**: Mod-LWE (Module Learning with Errors).
- **Function**: Identity binding and shared-secret derivation for the symmetric gauntlet.

### 1.1 Hardware-Unique Blending (HUB)

To ensure physical binding to the host machine, the ML-KEM Shared Secret ($SS$) is optionally blended with a machine-unique **Hardware ID** ($HWID$):

$$Blended\_SS = SS \parallel HWID$$

---

## 2. Key Derivation Function (KDF)

The system derives functional keys through a multi-stage SHA-256 and HMAC-SHA-256 chain to prevent key reuse.

1.  **Cipher Key**: $K_c = \text{SHA256}(\text{"dkasp-cipher-key"} \parallel Blended\_SS)$
2.  **HMAC Key**: $K_h = \text{SHA256}(\text{"dkasp-hmac-key"} \parallel Blended\_SS)$
3.  **Chain State**: $S_{chain} = \text{SHA256}(\text{"dkasp-chain-"} \parallel \text{hex}(K_c))$
4.  **Word Key**: $K_w = \text{HMAC-SHA256}(\text{hex}(K_c), \text{"dkasp-word-0"})$

---

## 3. The SPNA Gauntlet (16 Rounds)

The SPNA (Substitution-Permutation-Network-Algebraic) gauntlet is a 16-round transformation engine designed for maximum diffusion and algebraic complexity.

### 3.1 Round Structure

Each round $i$ applies four layers sequentially:
$$Round_i = Layer_A(Layer_N(Layer_P(Layer_S(\text{State}))))$$

### 3.2 Transformation Catalog

| Layer | Functional Group | Mathematical Operations                                                               |
| :---- | :--------------- | :------------------------------------------------------------------------------------ |
| **S** | **Substitution** | bit-level S-Boxes (4x4), Modular Multiplication ($\text{mod } 256$), Feistel network. |
| **P** | **Permutation**  | Fisher-Yates P-Box shuffles, Cyclic Rotations, Columnar transformations.              |
| **N** | **Network**      | MDS Matrix multiplication in $GF(2^8)$, Recursor XOR chains, Hill transformations.    |
| **A** | **Algebraic**    | Keyed XOR-summation, Modular Addition, Bit-flipping.                                  |

### 3.3 Deterministic Path Logic

The selection of transformations within each group is governed by a **DarkstarChaChaPRNG** (seeded with $K_w$).

- **Fixed Interval Substitution**: Rounds $i \equiv 0 \pmod 4$ and $i \equiv 2 \pmod 4$ use deterministic Substitution primitive selection to ensure baseline linear resistance.
- **Random Path**: All other layers are selected pseudo-randomly from their respective groups in each implementation (Rust, Go, Node.js, Python), ensuring bit-perfect parity.

---

## 4. Integrity & Enveloping

D-KASP employs an AEAD-like integrity check using HMAC-SHA256.

- **Payload**: $P = \text{Gauntlet}(Data)$
- **Ciphertext**: $CT = \text{ML-KEM.Encapsulate}(pk)$
- **Tag**: $T = \text{HMAC-SHA256}(K_h, CT \parallel P)$

The final versionless envelope is a flattened JSON object containing `data`, `ct`, and `mac`.

---

## 5. Security Properties

### 5.1 Resistance to Linear Cryptanalysis

The inclusion of fixed S-Box and MDS Network layers ensures that local input variations diffuse across the entire word-space within 3 rounds ($\text{Diffusion Rate} > 1.0$).

### 5.2 Algebraic Complexity

The combination of modular arithmetic and bitwise XORs ($ARX$ structure) creates high algebraic growth, preventing effective interpolation attacks using small rounds.
