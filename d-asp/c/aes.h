/**
 * @file aes.h
 * @brief AES-256 block cipher definitions.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#ifndef AES_H
#define AES_H

#include <stdint.h>

typedef struct {
    uint32_t rd_key[60];
    int rounds;
} aes_ctx;

void aes_256_setup(aes_ctx *ctx, const uint8_t *key);
void aes_256_encrypt(const aes_ctx *ctx, const uint8_t *plaintext, uint8_t *ciphertext);

#endif
