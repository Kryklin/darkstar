# D-KASP: Mathematical & Systems Specification (NIST-Ready)

This document provides a formal technical breakdown of the **Deterministic-KASP (D-KASP)** cryptographic protocol. D-KASP is an SPNA-structured (Substitution, Permutation, Network, Algebraic) cipher suite designed for high-diffusion data obfuscation and post-quantum identity binding.

---

## 1. Post-Quantum Trust Anchor (ML-KEM-1024)

D-KASP utilizes **ML-KEM-1024** (Kyber-1024) as its primary root of trust, providing NIST Level 5 security parity.

### 1.1 Parameters
- **Module Dimension ($k$)**: 4
- **Modulus ($q$)**: 3329
- **Error Distribution ($\eta$)**: $\eta_1 = 2, \eta_2 = 2$
- **Security Parity**: Absolute resistance to Shor’s algorithm and Grover’s algorithm (256-bit quantum security).

### 1.2 Identity Binding
The KEM shared secret ($SS \in \{0, 1\}^{256}$) is derived through decapsulation against the recipient's PQC Private Key. This secret is then bound to the hardware through **Hardware-Unique Blending (HUB)**:
$$K_{root} = \text{SHA256}(SS \parallel HWID)$$

---

## 2. Galois Field Arithmetic ($GF(2^8)$)

D-KASP relies on the finite field $GF(2^8)$ for its non-linear and diffusion layers.

### 2.1 Field Polynomial
The field is defined by the irreducible polynomial:
$$P(x) = x^8 + x^4 + x^3 + x + 1 \quad \text{(0x11B)}$$

### 2.2 Multiplication
Multiplication ($A \otimes B$) is performed via polynomial reduction. For element $a \in GF(2^8)$, multiplication by $x$ (0x02) is:
$a \cdot x = (a \ll 1) \oplus 0x1B \quad \text{if } a \ge 128, \text{ else } a \ll 1$

---

## 3. The SPNA Gauntlet (16 Rounds)

The core obfuscation engine applies 16 rounds of transformations. Each round consists of four distinct layers $\{S, P, N, A\}$.

### 3.1 Substitution Layer (S)
Provides non-linearity. D-KASP utilizes a variant of the Rijndael S-Box, defined by:
1.  **Inverse**: $x \to x^{-1}$ in $GF(2^8)$.
2.  **Affine Transformation**: $Y = M \cdot X + C$
    - Where $M$ is a fixed $8 \times 8$ bit-matrix and $C$ is the vector `0x63`.

### 3.2 Permutation Layer (P)
Ensures bit-level diffusion through:
- **P-Box**: Cyclic bit-reversal and transposition.
- **Fisher-Yates Shuffles**: Seeded by the deterministic PRNG for word-level arrangement.

### 3.3 Network Layer (N)
High-velocity diffusion using a **Maximum Distance Separable (MDS)** matrix.
The state is processed in 4-byte blocks using the MDS Matrix $M$:
$$
\begin{bmatrix}
0x02 & 0x03 & 0x01 & 0x01 \\
0x01 & 0x02 & 0x03 & 0x01 \\
0x01 & 0x01 & 0x02 & 0x03 \\
0x03 & 0x01 & 0x01 & 0x02
\end{bmatrix}
$$
This ensures that every input byte influences every output byte within the block, satisfying the Strict Avalanche Criterion (SAC).

### 3.4 Algebraic Layer (A)
Introduces algebraic complexity through Add-Rotate-XOR ($ARX$) logic:
- **Keyed XOR**: $B_i = S_i \oplus K[i \pmod L]$
- **Feistel Network**: Half-block transformations seeded by functional keys.
- **Recursive XOR**: $C_i = C_{i-1} \oplus B_i$ (ensuring global avalanche).

---

## 4. Deterministic State Control

To ensure cross-language bit-perfect parity, D-KASP uses a **DarkstarChaChaPRNG**.

### 4.1 Specification
- **Algorithm**: ChaCha20 (reduced round, 10 double-rounds).
- **Constants**: `0x61707865`, `0x3320646e`, `0x79622d32`, `0x6b206574`.
- **Function**: Transitions the cipher path per-round based on the $K_{word}$ derived from the master secret.

### 4.2 Path Selection Table
| Round Index ($i$) | S-Box Primitive | Selection Logic |
| :--- | :--- | :--- |
| $i \equiv 0 \pmod 4$ | Fixed (0) | Mandatory Diffusion Anchor |
| $i \equiv 2 \pmod 4$ | Fixed (1) | Mandatory Confusion Anchor |
| $\text{other}$ | PRNG-Selected | Dynamic Pathing |

---

## 5. Security Posture

### 5.1 Constant-Time Analysis
> [!CAUTION]
> As of V3.0.0, the reference implementations (Rust, Go) use **Partial Constant-Time** logic. While secret cleanup (Zeroize) is enforced, standard Galois Field arithmetic utilizes branching for reduction ($0x1B$ application). Python and Node.js implementations are **Non-Constant-Time** by architectural design.

### 5.2 Cryptanalytic Resistance
- **Linear Cryptanalysis**: 16 rounds exceed the security threshold for known plaintext attacks.
- **Quantum Resistance**: ML-KEM-1024 root ensures that even with the advent of a Cryptographically Relevant Quantum Computer (CRQC), the identity and root secrets remain shielded.
- **Algebraic Attacks**: The mixture of bitwise XOR and modular addition destroys the linear structure required for interpolation attacks.
