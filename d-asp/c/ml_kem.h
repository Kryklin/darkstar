/**
 * @file ml_kem.h
 * @brief ML-KEM-1024 high-level primitives.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 * 
 * See <http://creativecommons.org/publicdomain/zero/1.0/>
 */

#ifndef ML_KEM_H
#define ML_KEM_H

#include <stdint.h>
#include <stddef.h>
#include "poly.h"

#define MLKEM_K 4
#define MLKEM_N 256
#define MLKEM_Q 3329

int crypto_kem_keypair(uint8_t *pk, uint8_t *sk);
int crypto_kem_enc(uint8_t *ct, uint8_t *ss, const uint8_t *pk);
int crypto_kem_dec(uint8_t *ss, const uint8_t *ct, const uint8_t *sk);

#endif
