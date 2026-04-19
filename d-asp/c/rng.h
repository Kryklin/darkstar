/**
 * @file rng.h
 * @brief Deterministic Random Bit Generator prototypes.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#ifndef RNG_H
#define RNG_H

#include <stdint.h>

#define RNG_SUCCESS      0
#define RNG_BAD_MAX_LEN -1
#define RNG_BAD_OUTBUF  -2
#define RNG_BAD_RESEED  -3

void randombytes_init(unsigned char *entropy_input,
                      unsigned char *personalization_string,
                      int security_strength);

int randombytes(unsigned char *x, unsigned long long xlen);

#endif
