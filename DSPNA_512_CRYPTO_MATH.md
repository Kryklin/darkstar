# Cryptographic Mathematics (D-SPNA-512)

The core of D-SPNA-512 is an extended ChaCha-style ARX (Addition-Rotation-XOR) matrix, scaled to securely process a 512-bit initial entropy state derived from ML-KEM-1024.

## HKDF State Expansion
1. The ML-KEM-1024 algorithm outputs a 32-byte shared secret (`ss`).
2. An HKDF-SHA256 expansion utilizes an optional hardware ID (HWID) as salt to derive a 64-byte (512-bit) PRNG core seed.
3. This 512-bit seed is split into a 32-byte cipher hash and a 32-byte HMAC key.

## The ARX Cascade
The cryptographic cascade operates on 256-bit blocks (32 bytes) at a time, utilizing 16 structural rounds.
- **State Initialization**: The 256-bit block is loaded into a SIMD vector (YMM, ZMM, or dual Q-registers).
- **Key Addition**: `state = state + round_key`
- **XOR Injection**: `state = state ^ RC` (where RC is a dynamic round constant).
- **Permutation**: The state is pseudo-randomly shuffled using dynamic lane permutations.
- **Rotation**: The state undergoes bitwise rotations (`16`, `12`, `8`, `7`).
- **Blending**: The original state and the rotated state are cryptographically blended using conditional masks (`0xF0`, `0xCC`, `0xAA`).

The result is a cryptographically irreversible cipher block that operates securely on any hardware platform, bounded by a 512-bit initial state matrix.
