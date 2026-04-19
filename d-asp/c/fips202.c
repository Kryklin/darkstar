/**
 * @file fips202.c
 * @brief Implementation of the SHA-3 (Keccak) hash and XOF functions.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#include "fips202.h"
#include <string.h>
#include <stddef.h>

/** @brief Number of rounds for Keccak-f[1600] */
#define NROUNDS 24

static uint64_t load64(const uint8_t *x) {
    uint64_t r = 0;
    for (int i = 0; i < 8; i++) r |= (uint64_t)x[i] << (8 * i);
    return r;
}

static void store64(uint8_t *x, uint64_t u) {
    for (int i = 0; i < 8; i++) x[i] = (uint8_t)(u >> (8 * i));
}

/**
 * @brief Keccak-f[1600] state permutation.
 * 
 * Implements the 24-round Keccak-f permutation as defined in Section 3 
 * of FIPS 202.
 */
static void KeccakF1600_StatePermute(uint64_t state[25]) {
    static const uint64_t KeccakF_RoundConstants[NROUNDS] = {
        0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL,
        0x8000000080008000ULL, 0x000000000000808bULL, 0x0000000080000001ULL,
        0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008aULL,
        0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
        0x000000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL,
        0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
        0x000000000000800aULL, 0x800000008000000aULL, 0x8000000080008081ULL,
        0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL
    };

    static const int keccakf_rotc[24] = {
         1,  3,  6, 10, 15, 21, 28, 36, 45, 55,  2, 14,
        27, 41, 56,  8, 25, 43, 62, 18, 39, 61, 20, 44
    };
    static const int keccakf_piln[24] = {
        10,  7, 11, 17, 18, 3,  5, 16,  8, 21, 24, 4,
        15, 23, 19, 13, 12, 2, 20, 14, 22,  9,  6,  1
    };

    int i, j, round;
    uint64_t t, bc[5];

    for (round = 0; round < NROUNDS; round++) {
        // Theta
        for (i = 0; i < 5; i++)
            bc[i] = state[i] ^ state[i+5] ^ state[i+10] ^ state[i+15] ^ state[i+20];

        for (i = 0; i < 5; i++) {
            t = bc[(i + 4) % 5] ^ ((bc[(i + 1) % 5] << 1) | (bc[(i + 1) % 5] >> 63));
            for (j = 0; j < 25; j += 5) state[j + i] ^= t;
        }

        // Rho + Pi
        t = state[1];
        for (i = 0; i < 24; i++) {
            j = keccakf_piln[i];
            bc[0] = state[j];
            state[j] = (t << keccakf_rotc[i]) | (t >> (64 - keccakf_rotc[i]));
            t = bc[0];
        }

        // Chi
        for (j = 0; j < 25; j += 5) {
            for (i = 0; i < 5; i++) bc[i] = state[j + i];
            for (i = 0; i < 5; i++) state[j + i] ^= (~bc[(i + 1) % 5]) & bc[(i + 2) % 5];
        }

        // Iota
        state[0] ^= KeccakF_RoundConstants[round];
    }
}

/**
 * @brief Sponge construction: Absorption phase.
 * 
 * Absorbs input data into the Keccak state with specified rate and padding.
 */
static void keccak_absorb(uint64_t s[25], unsigned int rate,
                          const uint8_t *in, size_t inlen, uint8_t p) {
    size_t i;

    while (inlen >= rate) {
        for (i = 0; i < rate / 8; i++)
            s[i] ^= load64(in + 8 * i);
        KeccakF1600_StatePermute(s);
        in += rate;
        inlen -= rate;
    }

    uint8_t t[200] = {0};
    memcpy(t, in, inlen);
    t[inlen] = p;
    t[rate - 1] |= 0x80;
    for (i = 0; i < rate / 8; i++)
        s[i] ^= load64(t + 8 * i);
    KeccakF1600_StatePermute(s);
}

/**
 * @brief Sponge construction: Squeezing phase.
 * 
 * Squeezes output data from the Keccak state.
 */
static void keccak_squeeze(uint8_t *out, size_t outlen,
                           uint64_t s[25], unsigned int rate) {
    size_t i, bytesInBlock;

    while (outlen > 0) {
        bytesInBlock = (outlen < rate) ? outlen : rate;
        for (i = 0; i < bytesInBlock; i++)
            out[i] = (uint8_t)(s[i / 8] >> (8 * (i % 8)));
        out += bytesInBlock;
        outlen -= bytesInBlock;
        if (outlen > 0)
            KeccakF1600_StatePermute(s);
    }
}

/**
 * @brief SHAKE-128 Extendable-Output Function (XOF).
 */
void shake128(uint8_t *out, size_t outlen, const uint8_t *in, size_t inlen) {
    uint64_t s[25] = {0};
    keccak_absorb(s, SHAKE128_RATE, in, inlen, 0x1F);
    keccak_squeeze(out, outlen, s, SHAKE128_RATE);
}

void shake256(uint8_t *out, size_t outlen, const uint8_t *in, size_t inlen) {
    uint64_t s[25] = {0};
    keccak_absorb(s, SHAKE256_RATE, in, inlen, 0x1F);
    keccak_squeeze(out, outlen, s, SHAKE256_RATE);
}

/**
 * @brief SHA3-256 Hash Function.
 */
void sha3_256(uint8_t *out, const uint8_t *in, size_t inlen) {
    uint64_t s[25] = {0};
    keccak_absorb(s, SHA3_256_RATE, in, inlen, 0x06);
    keccak_squeeze(out, 32, s, SHA3_256_RATE);
}

void sha3_512(uint8_t *out, const uint8_t *in, size_t inlen) {
    uint64_t s[25] = {0};
    keccak_absorb(s, SHA3_512_RATE, in, inlen, 0x06);
    keccak_squeeze(out, 64, s, SHA3_512_RATE);
}

/**
 * @brief Initializes the incremental SHAKE128 context.
 */
void shake128_init(shake_ctx *state) {
    memset(state->s, 0, sizeof(state->s));
    state->pos = 0;
    state->rate = SHAKE128_RATE;
}

void shake128_absorb(shake_ctx *state, const uint8_t *in, size_t inlen) {
    while (inlen > 0) {
        unsigned int r = state->rate;
        size_t chunk = (inlen < (size_t)(r - state->pos)) ? inlen : (size_t)(r - state->pos);
        for (size_t i = 0; i < chunk; i++) {
            state->s[(state->pos + i) / 8] ^= (uint64_t)in[i] << (8 * ((state->pos + i) % 8));
        }
        state->pos += (unsigned int)chunk;
        in += chunk;
        inlen -= chunk;
        if (state->pos == r) {
            KeccakF1600_StatePermute(state->s);
            state->pos = 0;
        }
    }
}

void shake128_finalize(shake_ctx *state) {
    unsigned int r = state->rate;
    state->s[state->pos / 8] ^= (uint64_t)0x1F << (8 * (state->pos % 8));
    state->s[(r - 1) / 8] ^= (uint64_t)0x80 << (8 * ((r - 1) % 8));
    KeccakF1600_StatePermute(state->s);
    state->pos = 0;
}

void shake128_squeeze(uint8_t *out, size_t outlen, shake_ctx *state) {
    unsigned int r = state->rate;
    while (outlen > 0) {
        if (state->pos == r) {
            KeccakF1600_StatePermute(state->s);
            state->pos = 0;
        }
        *out++ = (uint8_t)(state->s[state->pos / 8] >> (8 * (state->pos % 8)));
        outlen--;
        state->pos++;
    }
}

/* Incremental SHAKE256 API (reuses SHAKE128 code) */
void shake256_init(shake_ctx *state) {
    memset(state->s, 0, sizeof(state->s));
    state->pos = 0;
    state->rate = SHAKE256_RATE;
}

void shake256_absorb(shake_ctx *state, const uint8_t *in, size_t inlen) {
    shake128_absorb(state, in, inlen);
}

void shake256_finalize(shake_ctx *state) {
    shake128_finalize(state);
}

void shake256_squeeze(uint8_t *out, size_t outlen, shake_ctx *state) {
    shake128_squeeze(out, outlen, state);
}
