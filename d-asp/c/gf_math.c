/**
 * @file gf_math.c
 * @brief Core arithmetic for the D-ASP (ASP Cascade 16) suite.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 * 
 * Provides constant-time multiplication for the D-ASP transformation layers.
 */

#include "dasp.h"

/**
 * @brief Constant-Time Galois Field GF(2^8) Multiplication.
 * 
 * Utilizes branchless arithmetic masking to neutralize instruction-timing 
 * side channels. Uses the Rijndael irreducible polynomial: x^8 + x^4 + x^3 + x + 1.
 * 
 * @param a First operand.
 * @param b Second operand.
 * @return Product in GF(2^8).
 */
uint8_t d_asp_gf_mult(uint8_t a, uint8_t b) {
    uint8_t p = 0;
    for (int i = 0; i < 8; i++) {
        /* If LSB of b is 1, mask is 0xFF, else 0x00 */
        uint8_t b_mask = (uint8_t)(-(b & 1));
        p ^= (a & b_mask);

        /* Binary reduction mask: if MSB of a is 1, mask is 0xFF */
        uint8_t reduction_mask = (uint8_t)((int8_t)a >> 7);
        
        a <<= 1;
        a ^= (0x1B & reduction_mask);
        b >>= 1;
    }
    return p;
}
