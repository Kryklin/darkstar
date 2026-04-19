/**
 * @file fips202.h
 * @brief Keccak-f[1600] and SHA-3 family definitions.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#ifndef FIPS202_H
#define FIPS202_H

#include <stdint.h>
#include <stddef.h>

#define SHAKE128_RATE 168
#define SHAKE256_RATE 136
#define SHA3_256_RATE 136
#define SHA3_512_RATE 72

void shake128(uint8_t *out, size_t outlen, const uint8_t *in, size_t inlen);
void shake256(uint8_t *out, size_t outlen, const uint8_t *in, size_t inlen);
void sha3_256(uint8_t *out, const uint8_t *in, size_t inlen);
void sha3_512(uint8_t *out, const uint8_t *in, size_t inlen);

// Incremental API for SHAKE (needed for Kyber sampling)
typedef struct {
    uint64_t s[25];
    unsigned int pos;
    unsigned int rate;
} shake_ctx;

void shake128_init(shake_ctx *state);
void shake128_absorb(shake_ctx *state, const uint8_t *in, size_t inlen);
void shake128_finalize(shake_ctx *state);
void shake128_squeeze(uint8_t *out, size_t outlen, shake_ctx *state);

void shake256_init(shake_ctx *state);
void shake256_absorb(shake_ctx *state, const uint8_t *in, size_t inlen);
void shake256_finalize(shake_ctx *state);
void shake256_squeeze(uint8_t *out, size_t outlen, shake_ctx *state);

#endif
