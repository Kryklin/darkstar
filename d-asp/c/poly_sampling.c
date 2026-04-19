/**
 * @file poly_sampling.c
 * @brief Polynomial compression and noise sampling logic.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#include "poly.h"
#include "fips202.h"
#include <string.h>

/**
 * @brief Compresses polynomial coefficients into a bitstring.
 * Maps coefficients from Z_q down to a smaller range (d bits) to reduce 
 * ciphertext size.
 * 
 * @param r Output byte buffer.
 * @param a Input polynomial.
 * @param d Target bit-depth (11 or 5 for ML-KEM-1024).
 */
void poly_compress(uint8_t *r, const poly *a, int d) {
    if (d == 11) {
        for (int i = 0; i < 32; i++) {
            uint16_t t[8];
            for (int j = 0; j < 8; j++) {
                int16_t t_coeff = barrett_reduce(a->coeffs[8 * i + j]);
                t_coeff += (t_coeff >> 15) & Q;
                t[j] = (uint16_t)((((uint32_t)t_coeff << 11) + 1664) / Q) & 0x7FF;
            }
            r[0] = (uint8_t)(t[0] >> 0);
            r[1] = (uint8_t)((t[0] >> 8) | (t[1] << 3));
            r[2] = (uint8_t)((t[1] >> 5) | (t[2] << 6));
            r[3] = (uint8_t)(t[2] >> 2);
            r[4] = (uint8_t)((t[2] >> 10) | (t[3] << 1));
            r[5] = (uint8_t)((t[3] >> 7) | (t[4] << 4));
            r[6] = (uint8_t)((t[4] >> 4) | (t[5] << 7));
            r[7] = (uint8_t)(t[5] >> 1);
            r[8] = (uint8_t)((t[5] >> 9) | (t[6] << 2));
            r[9] = (uint8_t)((t[6] >> 6) | (t[7] << 5));
            r[10] = (uint8_t)(t[7] >> 3);
            r += 11;
        }
    } else if (d == 5) {
        for (int i = 0; i < 32; i++) {
            uint8_t t[8];
            for (int j = 0; j < 8; j++) {
                int16_t t_coeff = barrett_reduce(a->coeffs[8 * i + j]);
                t_coeff += (t_coeff >> 15) & Q;
                t[j] = (uint8_t)((((uint32_t)t_coeff << 5) + 1664) / Q) & 0x1F;
            }
            r[0] = t[0] | (t[1] << 5);
            r[1] = (t[1] >> 3) | (t[2] << 2) | (t[3] << 7);
            r[2] = (t[3] >> 1) | (t[4] << 4);
            r[3] = (t[4] >> 4) | (t[5] << 1) | (t[6] << 6);
            r[4] = (t[6] >> 2) | (t[7] << 3);
            r += 5;
        }
    }
}

/**
 * @brief Decompresses a bitstring into polynomial coefficients.
 * Maps coefficients from d-bit value back to Z_q (Algorithm 2 in FIPS 203).
 */
void poly_decompress(poly *r, const uint8_t *a, int d) {
    if (d == 11) {
        for (int i = 0; i < 32; i++) {
            uint16_t t[8];
            t[0] = (uint16_t)(a[0]) | ((uint16_t)a[1] << 8);
            t[1] = (uint16_t)(a[1] >> 3) | ((uint16_t)a[2] << 5);
            t[2] = (uint16_t)(a[2] >> 6) | ((uint16_t)a[3] << 2) | ((uint16_t)a[4] << 10);
            t[3] = (uint16_t)(a[4] >> 1) | ((uint16_t)a[5] << 7);
            t[4] = (uint16_t)(a[5] >> 4) | ((uint16_t)a[6] << 4);
            t[5] = (uint16_t)(a[6] >> 7) | ((uint16_t)a[7] << 1) | ((uint16_t)a[8] << 9);
            t[6] = (uint16_t)(a[8] >> 2) | ((uint16_t)a[9] << 6);
            t[7] = (uint16_t)(a[9] >> 5) | ((uint16_t)a[10] << 3);
            for (int j = 0; j < 8; j++) {
                r->coeffs[8 * i + j] = (int16_t)((((uint32_t)(t[j] & 0x7FF)) * Q + 1024) >> 11);
            }
            a += 11;
        }
    } else if (d == 5) {
        for (int i = 0; i < 32; i++) {
            uint8_t t[8];
            t[0] = a[0];
            t[1] = (a[0] >> 5) | (a[1] << 3);
            t[2] = (a[1] >> 2);
            t[3] = (a[1] >> 7) | (a[2] << 1);
            t[4] = (a[2] >> 4) | (a[3] << 4);
            t[5] = (a[3] >> 1);
            t[6] = (a[3] >> 6) | (a[4] << 2);
            t[7] = (a[4] >> 3);
            for (int j = 0; j < 8; j++) {
                r->coeffs[8 * i + j] = (int16_t)((((uint32_t)(t[j] & 0x1F)) * Q + 16) >> 5);
            }
            a += 5;
        }
    }
}

/**
 * @brief Encodes a polynomial into a 384-byte array (3 bytes per 2 coefficients).
 * Each coefficient is 12-bit (0-4095).
 */
void poly_tobytes(uint8_t *r, const poly *a) {
    for (int i = 0; i < 128; i++) {
        int16_t t0 = barrett_reduce(a->coeffs[2 * i + 0]);
        t0 += (t0 >> 15) & Q;
        int16_t t1 = barrett_reduce(a->coeffs[2 * i + 1]);
        t1 += (t1 >> 15) & Q;
        
        r[3 * i + 0] = (uint8_t)(t0 >> 0);
        r[3 * i + 1] = (uint8_t)((t0 >> 8) | (t1 << 4));
        r[3 * i + 2] = (uint8_t)(t1 >> 4);
    }
}

/**
 * @brief Decodes a 384-byte array into polynomial coefficients.
 */
void poly_frombytes(poly *r, const uint8_t *a) {
    for (int i = 0; i < 128; i++) {
        r->coeffs[2 * i + 0] = (int16_t)((a[3 * i + 0] >> 0) | ((uint16_t)a[3 * i + 1] << 8)) & 0xFFF;
        r->coeffs[2 * i + 1] = (int16_t)((a[3 * i + 1] >> 4) | ((uint16_t)a[3 * i + 2] << 4)) & 0xFFF;
    }
}

/**
 * @brief Centered Binomial Distribution (CBD) sampler.
 * Implementation of Algorithm 11 (SamplePolyCBD) in FIPS 203 with eta=2.
 * @param r Output polynomial.
 * @param buf Input noise block (128 bytes).
 */
void poly_cbd_eta2(poly *r, const uint8_t *buf) {
    uint32_t t, d;
    int a, b;
    for (int i = 0; i < 32; i++) {
        t = (uint32_t)buf[4*i] | ((uint32_t)buf[4*i+1] << 8) | ((uint32_t)buf[4*i+2] << 16) | ((uint32_t)buf[4*i+3] << 24);
        d = t & 0x55555555;
        d += (t >> 1) & 0x55555555;
        for (int j = 0; j < 8; j++) {
            a = (int)((d >> (4 * j + 0)) & 0x3);
            b = (int)((d >> (4 * j + 2)) & 0x3);
            r->coeffs[8 * i + j] = (int16_t)(a - b);
        }
    }
}

void poly_getnoise_eta1(poly *r, const uint8_t *seed, uint8_t nonce) {
    uint8_t buf[128];
    uint8_t extseed[33];
    memcpy(extseed, seed, 32);
    extseed[32] = nonce;
    shake256(buf, 128, extseed, 33);
    poly_cbd_eta2(r, buf);
}

void poly_getnoise_eta2(poly *r, const uint8_t *seed, uint8_t nonce) {
    uint8_t buf[128];
    uint8_t extseed[33];
    memcpy(extseed, seed, 32);
    extseed[32] = nonce;
    shake256(buf, 128, extseed, 33);
    poly_cbd_eta2(r, buf);
}

/**
 * @brief Samples a polynomial from a Uniform distribution using rejection.
 * Implementation of Algorithm 10 (SamplePolyUniform) in FIPS 203.
 * Uses SHAKE-128 as the underlying XOF.
 * 
 * @return Number of coefficients sampled (always 256 for this implementation).
 */
int poly_getnoise_rej(poly *r, const uint8_t *seed, size_t seed_len) {
    uint8_t buf[SHAKE128_RATE];
    shake_ctx state;
    shake128_init(&state);
    shake128_absorb(&state, seed, seed_len);
    shake128_finalize(&state);
    
    int count = 0;
    while (count < 256) {
        shake128_squeeze(buf, SHAKE128_RATE, &state);
        for (int i = 0; i < SHAKE128_RATE && count < 256; i += 3) {
            uint16_t val0 = (uint16_t)(buf[i] | ((uint16_t)buf[i+1] << 8)) & 0xFFF;
            uint16_t val1 = (uint16_t)((buf[i+1] >> 4) | ((uint16_t)buf[i+2] << 4)) & 0xFFF;
            if (val0 < Q) r->coeffs[count++] = (int16_t)val0;
            if (count < 256 && val1 < Q) r->coeffs[count++] = (int16_t)val1;
        }
    }
    return 256;
}
