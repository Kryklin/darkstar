/**
 * @file sha256.h
 * @brief SHA-256 and HMAC-SHA256 prototypes.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#ifndef SHA256_H
#define SHA256_H

#include <stdint.h>
#include <stddef.h>

/** @brief Computes SHA-256 hash */
void crypto_sha256(const uint8_t *data, size_t len, uint8_t *out);

/** @brief Computes HMAC-SHA256 authenticated hash */
void crypto_hmac_sha256(const uint8_t *key, size_t key_len, const uint8_t *data, size_t data_len, uint8_t *out);

#endif
