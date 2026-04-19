/**
 * @file poly.h
 * @brief Polynomial and polynomial vector definitions for ML-KEM.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#ifndef POLY_H
#define POLY_H

#include <stdint.h>
#include <stddef.h>

#define Q 3329
#define MLKEM_K 4

typedef struct {
    int16_t coeffs[256];
} poly;

typedef struct {
    poly vec[4]; // k=4 for ML-KEM-1024
} polyvec;

int16_t montgomery_reduce(int32_t a);
int16_t barrett_reduce(int16_t a);
void poly_reduce(poly *r);
void polyvec_reduce(polyvec *r);
void poly_ntt(poly *a);
void poly_invntt(poly *a);
void poly_tomont(poly *a);
void poly_basemul_montgomery(poly *r, const poly *a, const poly *b);
void poly_add(poly *r, const poly *a, const poly *b);
void polyvec_add(polyvec *r, const polyvec *a, const polyvec *b);
void poly_sub(poly *r, const poly *a, const poly *b);

void polyvec_ntt(polyvec *a);
void polyvec_invntt(polyvec *a);
void polyvec_tomont(polyvec *a);
void polyvec_ntt_v(polyvec *v);
void polyvec_invntt_v(polyvec *v);
void polyvec_basemul_acc_montgomery(poly *r, const polyvec *a, const polyvec *b);

void poly_tobytes(uint8_t *r, const poly *a);
void poly_frombytes(poly *r, const uint8_t *a);
void poly_compress(uint8_t *r, const poly *a, int d);
void poly_decompress(poly *r, const uint8_t *a, int d);
void poly_getnoise_eta1(poly *r, const uint8_t *seed, uint8_t nonce);
void poly_getnoise_eta2(poly *r, const uint8_t *seed, uint8_t nonce);
int poly_getnoise_rej(poly *r, const uint8_t *seed, size_t seed_len);

#endif
