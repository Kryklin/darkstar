/**
 * @file sha256.c
 * @brief Implementation of the SHA-256 hash and HMAC functions.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#include "sha256.h"
#include <string.h>
#include <stdlib.h>

/* SHA-256 logical functions as defined in FIPS 180-4 */
#define ROTR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
#define CH(x, y, z) (((x) & (y)) ^ (~(x) & (z)))
#define MAJ(x, y, z) (((x) & (y)) ^ ((x) & (z)) ^ ((y) & (z)))
#define SIG0(x) (ROTR(x, 2) ^ ROTR(x, 13) ^ ROTR(x, 22))
#define SIG1(x) (ROTR(x, 6) ^ ROTR(x, 11) ^ ROTR(x, 25))
#define sig0(x) (ROTR(x, 7) ^ ROTR(x, 18) ^ ((x) >> 3))
#define sig1(x) (ROTR(x, 17) ^ ROTR(x, 19) ^ ((x) >> 10))

static const uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

/**
 * @brief Performs the core SHA-256 compression on a 64-byte block.
 */
static void transform(uint32_t *state, const uint8_t *data) {
    uint32_t a, b, c, d, e, f, g, h, t1, t2, w[64];
    for (int i = 0; i < 16; i++) {
        w[i] = (uint32_t)data[i * 4] << 24 | (uint32_t)data[i * 4 + 1] << 16 |
               (uint32_t)data[i * 4 + 2] << 8 | (uint32_t)data[i * 4 + 3];
    }
    for (int i = 16; i < 64; i++) w[i] = sig1(w[i - 2]) + w[i - 7] + sig0(w[i - 15]) + w[i - 16];
    a = state[0]; b = state[1]; c = state[2]; d = state[3]; e = state[4]; f = state[5]; g = state[6]; h = state[7];
    for (int i = 0; i < 64; i++) {
        t1 = h + SIG1(e) + CH(e, f, g) + K[i] + w[i];
        t2 = SIG0(a) + MAJ(a, b, c);
        h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
    }
    state[0] += a; state[1] += b; state[2] += c; state[3] += d; state[4] += e; state[5] += f; state[6] += g; state[7] += h;
}

/**
 * @brief Computes the SHA-256 hash of the input data.
 * @param data Input data buffer.
 * @param len Length of data in bytes.
 * @param out 32-byte output hash buffer.
 */
void crypto_sha256(const uint8_t *data, size_t len, uint8_t *out) {
    uint32_t state[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
    uint8_t buf[128];
    uint64_t bitlen = len * 8;
    while (len >= 64) { transform(state, data); data += 64; len -= 64; }
    memcpy(buf, data, len);
    buf[len++] = 0x80;
    if (len > 56) { memset(buf + len, 0, 64 - len); transform(state, buf); len = 0; }
    memset(buf + len, 0, 56 - len);
    for (int i = 0; i < 8; i++) buf[63 - i] = (uint8_t)(bitlen >> (i * 8));
    transform(state, buf);
    for (int i = 0; i < 8; i++) {
        out[i * 4] = state[i] >> 24; out[i * 4 + 1] = state[i] >> 16;
        out[i * 4 + 2] = state[i] >> 8; out[i * 4 + 3] = state[i];
    }
}

/**
 * @brief Computes the HMAC-SHA256 authenticated hash.
 * Implements Algorithm defined in RFC 2104.
 */
void crypto_hmac_sha256(const uint8_t *key, size_t key_len, const uint8_t *data, size_t data_len, uint8_t *out) {
    uint8_t k[64] = {0};
    uint8_t ipad[64], opad[64];
    if (key_len > 64) crypto_sha256(key, key_len, k);
    else memcpy(k, key, key_len);
    for (int i = 0; i < 64; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
    
    // Using a more robust HMAC construction helper
    uint8_t inner_hash[32];
    // This part is simplified for brevity in RI, but would use a Context-based hash for large data
    // For D-ASP, payloads are usually small enough for simple buffers
    uint8_t *inner_buf = malloc(64 + data_len);
    memcpy(inner_buf, ipad, 64);
    memcpy(inner_buf + 64, data, data_len);
    crypto_sha256(inner_buf, 64 + data_len, inner_hash);
    free(inner_buf);
    
    uint8_t outer_buf[64 + 32];
    memcpy(outer_buf, opad, 64);
    memcpy(outer_buf + 64, inner_hash, 32);
    crypto_sha256(outer_buf, 96, out);
}
