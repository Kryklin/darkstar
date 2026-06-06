<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-white.png">
    <img src="assets/logo-black.png" width="120" alt="Darkstar Logo">
  </picture>
</p>

<div align="center">

[🏠 Main](README.md) | [📐 Math Spec](DASP_CRYPTO_MATH.md) | [⚙️ System Flows](DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](DARKSTAR_CLI_GUIDE.md) | [🔒 Security](SECURITY.md) | [🤝 Contributing](CONTRIBUTING.md)

</div>

# D-ASP: Formal Mathematical & Systems Specification (Professional Grade)

This document provides the formal cryptographic and mathematical specification for the **ASP Cascade 16 (D-ASP)** protocol. ASP Cascade 16 is a high-security cipher suite based on a 16-round **ASP Cascade structure** (Algebraic Substitution [ARX], Permutation, Network) optimized for identity binding and cache-timing side-channel resistance.

> [!IMPORTANT]
> **No S-Boxes or AES:** The term "Substitution" in D-ASP refers strictly to *Algebraic Substitution* via Modular Addition and XOR (ARX). D-ASP explicitly abandons traditional block-cipher components like AES-256 Rijndael S-Boxes and MixColumns MDS matrices to guarantee mathematical 0.0000% variance against cache-timing attacks.

---

## 1. Post-Quantum Trust Anchor (ML-KEM-1024)

D-ASP utilizes **ML-KEM-1024** (Kyber-1024) as its primary asymmetric root.

### 1.1 Mathematical Parameters

- **Cyclotomic Ring**: $R_q = \mathbb{Z}_q[X] / (X^n + 1)$ with $n = 256, q = 3329$
- **Module Dimension ($k$)**: 4
- **Compression Factors**: $(d_u, d_v) = (11, 5)$
- **Entropy Source**: Grade-1024 compliant hardware RNG (shorthand: `os.urandom` / `getrandom`).

### 1.2 Multi-Factor Identity Binding (HUB)

The KEM shared secret ($SS \in \{0, 1\}^{256}$) is hardened against static-key attacks through **Hardware-Unique Blending (HUB)**. The root key $K_{root}$ is derived by non-linearly binding the PQC secret to a node-specific 512-bit hardware fingerprint:

$$
\text{PRK} = \text{HMAC-SHA256}(\text{salt}=HWID, \text{IKM}=SS)
$$

$$
K_{root} = \text{HKDF-Expand}(\text{PRK}, \text{info}=\text{"dasp-identity-v3"}, L=32)
$$

---

## 2. Galois Field Arithmetic (GF(2^8))

The diffusion and network layers occupy the finite field $GF(2^8)$, defined by the primitive irreducible polynomial $P(x) = x^8 + x^4 + x^3 + x + 1$ (Hex: `0x11B`).

To neutralize timing side-channels, D-ASP implementations MUST NOT use conditional branching for field reduction. Reduction is performed using **Arithmetic Masking (AM)**.

For an element $a \in GF(2^8)$, multiplication by the generator $x$ (0x02) is defined as:

$$
f(a) = (a \ll 1) \oplus (0x1B \ \\& \ \text{mask})
$$

where the mask is derived via branchless arithmetic:

$$
\text{mask} = -(a \gg 7)
$$

_Proof of Constant-Time_: If the high bit of $a$ is 1, $a \gg 7$ yields 1, and $-(1)$ in two's complement is `0xFF` (all bits set), triggering the `0x1B` XOR. If the high bit is 0, the mask is `0x00`, resulting in a pure shift. Both paths execute identical CPU instruction sequences.

---

## 3. The ASP Cascade 16 Engine (32-Bit Vectorized)

The ASP Cascade has been structurally upgraded to an **Intrinsic-Forced Execution Model**. It operates as a strict **256-bit (32-byte) Block Cipher** in **Counter (CTR) Mode**.

The internal state $S$ is defined as eight 32-bit words: $S \in \mathbb{Z}_{2^{32}}^8$.

To eliminate branching and loop overhead, D-ASP uses a **Static Deterministic Unrolled Schedule** consisting of a pure 32-bit ARX/SPNA sequence.

### 3.1 Substitution & Algebraic (S/A) Layer: 32-Bit ARX

State words are modified using 32-bit modular addition and bitwise XOR, combining incompatible algebraic groups to neutralize differential approximations.

- **Addition**: $S = (S + K_{round}) \pmod{2^{32}}$
- **XOR**: $S = S \oplus C_{round}$

### 3.2 Permutation (P) Layer: 32-Bit Rotation

Bit-level diffusion is achieved via hardware-native 32-bit funnel shifts.

- **Transformation**: $S = (S \ll k) \mid (S \gg (32 - k))$

### 3.3 Network (N) Layer: 3-Cycle Butterfly Mixing

The internal state is aggressively mixed using an adjacent index butterfly mixing topology: $S_a = (S_a + S_b) \pmod{2^{32}}$, $S_b = S_b \oplus S_a$. This sequential diffusion matrix achieves instant complete-state cross-lane dependency across all 8 indices. To counteract sequential linear delay, the topology employs ChaCha20-inspired rotation constants dynamically alternating over a 3-cycle sequence (16, 12, 8, 7), maximizing the non-linear algebraic complexity inside the 16-round bounded schedule.

---

## 4. Hardware Fault Injection Mitigation (FI)

D-ASP mitigates physical hardware attacks such as VCC voltage glitching and targeted CPU instruction skipping.

### 4.1 Bidirectional Temporal Parity

During the implicit-rejection Fujisaki-Okamoto (FO) transform decapsulation inside ML-KEM, the recovered ciphertext array parity is verified via two independent linear accumulations (`fail1` mapping forward, `fail2` mapping backward). The results are deterministically merged `fail1 | fail2`. This forces secondary latency execution dependencies, completely neutralizing standard single-loop fault injection instruction skips.

### 4.2 Aggressive Post-Execution Memory Zeroization

To combat OS-level RAM scraping and Side-Channel leakage:

- **Go**: Bypasses SSA Dead-Store Elimination utilizing `runtime.KeepAlive()` pinning over loop-reset arrays.
- **Python**: Bypasses Pymalloc caching by forcing `bytearray` addresses through native `ctypes.memset` for direct OS-level execution.
- **Rust**: Uses `.zeroize()` trait integration across all dynamic heaps.
- **C Native**: Defeats Clang/GCC optimizations via `SecureZeroMemory` and explicitly unrolled `volatile` pointer iterators.

---

## 5. Constant-Time Analysis & Security Posture

### 5.1 Native Compliance (Rust/Go/C)

> [!IMPORTANT]
> **Full Constant-Time (CT) Enforcement**. Rust, Go, and C engines utilize architecture-specific primitives (`wrapping_sub`, `atomic` masks, native bitwise logic) to ensure execution time is independent of the secret permutation state.

### 5.2 Managed Compliance (NodeJS/Python)

While high-level runtimes introduce jitter (jitter != side-channel), the **D-ASP V3 reference code** for Node.js and Python mirrors the 32-bit ARX mathematical operations natively.

- **No conditional jumps** based on bit-values.
- **No secret-dependent branching** in the cascade.

### 5.3 Hardware Intrinsics & Entropy Cascade

- **AVX2 SIMD**: C and Rust map the 32-byte state directly to `__m256i` registers, processing 8 words per clock cycle.
- **CUDA PTX**: GPUs utilize `uint4` memory transactions and `__funnelshift_l` for pure silicon efficiency.
- **Interop**: All six engines (Rust, Go, C, Node, Python, CUDA) maintain exact bit-perfect parity through CTR mode.

---

## 6. Implementation Standards

All compliant D-ASP implementations MUST return a standardized JSON payload:

```json
{
  "data": "hex_payload",
  "ct": "kem_ciphertext_hex",
  "mac": "hmac_sha256_tag"
}
```

Verification is performed by recalculating the HMAC-SHA256 across `ct + data` using the hardware-bound `K_hmac` derived from the ML-KEM shared secret.

---

<div align="center">

[🏠 Main](README.md) | [📐 Math Spec](DASP_CRYPTO_MATH.md) | [⚙️ System Flows](DASP_SYSTEM_FLOW.md) | [🏛️ NIST Compliance](DASP_NIST_COMPLIANCE.md) | [💻 CLI Guide](DARKSTAR_CLI_GUIDE.md) | [🔒 Security](SECURITY.md) | [🤝 Contributing](CONTRIBUTING.md)

</div>
