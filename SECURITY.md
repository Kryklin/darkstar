# Security & Threat Model (D-SPNA-512)

D-SPNA-512 takes a zero-trust approach to hardware, operating under the assumption that the host CPU is actively hostile or vulnerable to micro-architectural side channels.

## 1. Post-Quantum Resilience
By integrating **ML-KEM-1024 (FIPS 203)**, the symmetric encryption payload is fully insulated from Shor's algorithm. The KEM shared secret is expanded into a 512-bit underlying state via HKDF-SHA256, feeding the ARX matrices with cryptographically pristine, quantum-resistant entropy.

## 2. Constant-Time Execution
The engine exclusively uses ARX (Addition, Rotation, XOR) logic. There are **zero memory-bound S-boxes**, naturally blinding the algorithm against cache-timing attacks (Flush+Reload).

## 3. Speculative Execution (Spectre/Meltdown)
During the authentication phase, the `mac_diff` validation creates a strict physical execution barrier.
- **x86/x64**: Issues `_mm_lfence()`.
- **ARM AArch64**: Issues `isb` and `csdb`.
If authentication fails, the CPU is physically blocked from speculatively entering the decryption loop, halting data leakage over the cache side-channel.

## 4. Hardware SIMD Leakage (Zenbleed / Ryzenbleed)
To prevent cross-process vector register leaks (like Zenbleed), the execution funnels enforce explicit hardware zeroing. Before exiting any vector cascade (`avx512`, `avx2`, `neon`), the engine forcefully writes `_mm256_setzero_si256()` or `vdupq_n_u32(0)` directly into volatile pointers, triggering `vpxor` micro-ops to blast the physical silicon registers with zeroes.

## 5. Differential Power Analysis (DPA)
To thwart attackers attempting to gather hundreds of identical statistical power traces, D-SPNA-512 utilizes a signature ring buffer. If the exact same KEM ciphertext or MAC signature is submitted 5 times within a sliding window of 10 requests, the engine traps the transaction and drops the operation. Furthermore, the dynamic DRBG reseeds the underlying stream per execution, guaranteeing the physical power footprint is permanently randomized.
