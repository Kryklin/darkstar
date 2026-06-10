# System Flow (D-SPNA-512)

## 1. Encapsulation (Sender)
1. **Input**: Plaintext payload and recipient's ML-KEM-1024 public key.
2. **KEM Generation**: Generates ciphertext (`ct`) and shared secret (`ss`).
3. **HKDF Expansion**: The `ss` is expanded into a 512-bit root state (Cipher Key + HMAC Key).
4. **Encryption**: The D-SPNA-512 ARX cascade encrypts the payload using the Cipher Key and a randomly generated nonce.
5. **Authentication**: An HMAC-SHA256 signature is calculated over the ciphertext and timestamps.
6. **Output**: `ct || nonce || ciphertext || MAC`

## 2. Decapsulation (Receiver)
1. **Input**: Payload string and recipient's ML-KEM-1024 secret key.
2. **KEM Recovery**: The `ct` is decapsulated to recover the shared secret (`ss`).
3. **HKDF Expansion**: The `ss` is expanded into the 512-bit root state.
4. **Authentication Check**: The MAC is verified. If verification fails, `lfence` or `isb/csdb` barriers trap the execution to prevent Spectre attacks.
5. **Decryption**: The ARX cascade decrypts the ciphertext.
6. **Hardware Erase**: SIMD registers (`YMM`, `ZMM`, `Q`) are explicitly wiped to prevent Zenbleed.
