/**
 * @file rng.c
 * @brief Deterministic Random Bit Generator (DRBG) implementation.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#include <string.h>
#include "rng.h"
#include "aes.h"

/** @brief DRBG Internal State (NIST SP 800-90A) */
typedef struct {
    unsigned char Key[32];      /**< AES-256 Key */
    unsigned char V[16];        /**< Counter Value */
    int reseed_counter;
} DRBG_CTX;

static DRBG_CTX drbg_ctx;

/**
 * @brief Single AES-256 ECB encryption for DRBG update/generation.
 */
static void AES256_ECB(unsigned char *key, unsigned char *ctr, unsigned char *buffer) {
    aes_ctx ctx;
    aes_256_setup(&ctx, key);
    aes_256_encrypt(&ctx, ctr, buffer);
}

/**
 * @brief Updates the DRBG state (Algorithm from NIST SP 800-90A).
 */
static void AES256_CTR_DRBG_Update(unsigned char *provided_data, unsigned char *Key, unsigned char *V) {
    unsigned char temp[48];
    for (int i=0; i<3; i++) {
        // Increment V
        for (int j=15; j>=0; j--) {
            if (V[j] == 0xff) V[j] = 0x00;
            else { V[j]++; break; }
        }
        AES256_ECB(Key, V, temp + i*16);
    }
    if (provided_data) {
        for (int i=0; i<48; i++) temp[i] ^= provided_data[i];
    }
    memcpy(Key, temp, 32);
    memcpy(V, temp + 32, 16);
}

/**
 * @brief Initializes the DRBG with entropy and personalization string.
 * @param entropy_input 48 bytes of initial entropy.
 * @param personalization_string Optional personalization string.
 * @param security_strength Ignored (fixed at 256 bits).
 */
void randombytes_init(unsigned char *entropy_input, unsigned char *personalization_string, int security_strength) {
    unsigned char seed_material[48];
    memcpy(seed_material, entropy_input, 48);
    if (personalization_string) {
        for (int i=0; i<48; i++) seed_material[i] ^= personalization_string[i];
    }
    memset(drbg_ctx.Key, 0, 32);
    memset(drbg_ctx.V, 0, 16);
    AES256_CTR_DRBG_Update(seed_material, drbg_ctx.Key, drbg_ctx.V);
    drbg_ctx.reseed_counter = 1;
}

/**
 * @brief Generates cryptographically secure random bytes.
 * @param x Output buffer.
 * @param xlen Number of bytes to generate.
 * @return RNG_SUCCESS (0).
 */
int randombytes(unsigned char *x, unsigned long long xlen) {
    unsigned char block[16];
    while (xlen > 0) {
        for (int j=15; j>=0; j--) {
            if (drbg_ctx.V[j] == 0xff) drbg_ctx.V[j] = 0x00;
            else { drbg_ctx.V[j]++; break; }
        }
        AES256_ECB(drbg_ctx.Key, drbg_ctx.V, block);
        if (xlen > 16) {
            memcpy(x, block, 16);
            x += 16;
            xlen -= 16;
        } else {
            memcpy(x, block, xlen);
            xlen = 0;
        }
    }
    AES256_CTR_DRBG_Update(NULL, drbg_ctx.Key, drbg_ctx.V);
    drbg_ctx.reseed_counter++;
    return RNG_SUCCESS;
}
