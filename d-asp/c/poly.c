/**
 * @file poly.c
 * @brief Polynomial arithmetic in the RING Z_q[X]/(X^256 + 1).
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#include "poly.h"

/** 
 * @brief Precomputed inverse of Q modulo 2^16. 
 * Used for Montgomery reduction.
 */
#define QINV 62209 

/**
 * @brief Zeta (Root of Unity) table for NTT/INVNTT.
 * zetas[i] = ω^{brv(i)} * 2^16 mod q, stored in signed form for Montgomery reduction.
 * Values derived from the NIST standard reference implementation.
 */
const int16_t zetas[128] = {
  -1044,  -758,  -359, -1517,  1493,  1422,   287,   202,
   -171,   622,  1577,   182,   962, -1202, -1474,  1468,
    573, -1325,   264,   383,  -829,  1458, -1602,  -130,
   -681,  1017,   732,   608, -1542,   411,  -205, -1571,
   1223,   652,  -552,  1015, -1293,  1491,  -282, -1544,
    516,    -8,  -320,  -666, -1618, -1162,   126,  1469,
   -853,   -90,  -271,   830,   107, -1421,  -247,  -951,
   -398,   961, -1508,  -725,   448, -1065,   677, -1275,
  -1103,   430,   555,   843, -1251,   871,  1550,   105,
    422,   587,   177,  -235,  -291,  -460,  1574,  1653,
   -246,   778,  1159,  -147,  -777,  1483,  -602,  1119,
  -1590,   644,  -872,   349,   418,   329,  -156,   -75,
    817,  1097,   603,   610,  1322, -1285, -1465,   384,
  -1215,  -136,  1218, -1335,  -874,   220, -1187, -1659,
  -1185, -1530, -1278,   794, -1510,  -854,  -870,   478,
   -108,  -308,   996,   991,   958, -1460,  1522,  1628
};

/**
 * @brief Montgomery reduction (Algorithm 14 in FIPS 203).
 * Reduces a 32-bit signed integer modulo Q * 2^16.
 * @return Value in range (-Q, Q).
 */
int16_t montgomery_reduce(int32_t a) {
    int16_t t;
    t = (int16_t)a * QINV;
    t = (int16_t)((a - (int32_t)t * Q) >> 16);
    return t;
}

static int16_t fqmul(int16_t a, int16_t b) {
    return montgomery_reduce((int32_t)a * b);
}

/**
 * @brief Barrett reduction (Algorithm 15 in FIPS 203).
 * Reduces a 16-bit signed integer modulo Q.
 */
int16_t barrett_reduce(int16_t a) {
    int16_t t;
    const int16_t v = 20159;
    t = (int16_t)(((int32_t)v * a + (1 << 25)) >> 26);
    t *= Q;
    return a - t;
}

/**
 * @brief Reduces all coefficients of a polynomial using Barrett reduction.
 */
void poly_reduce(poly *a) {
    for (int i = 0; i < 256; i++) a->coeffs[i] = barrett_reduce(a->coeffs[i]);
}

void polyvec_reduce(polyvec *r) {
    for (int i = 0; i < MLKEM_K; i++) poly_reduce(&r->vec[i]);
}

/**
 * @brief Forward Number Theoretic Transform (NTT).
 * 
 * Maps a polynomial into the NTT domain using the Cooley-Tukey butterfly.
 * Input is in standard order, output is in bit-reversed order.
 */
void poly_ntt(poly *r) {
    unsigned int len, start, j, k;
    int16_t t, zeta;
    k = 1;
    for (len = 128; len >= 2; len >>= 1) {
        for (start = 0; start < 256; start = j + len) {
            zeta = zetas[k++];
            for (j = start; j < start + len; j++) {
                t = fqmul(zeta, r->coeffs[j + len]);
                r->coeffs[j + len] = r->coeffs[j] - t;
                r->coeffs[j] = r->coeffs[j] + t;
            }
        }
    }
}

/**
 * @brief Inverse Number Theoretic Transform (iNTT).
 * 
 * Maps a polynomial from the NTT domain back to standard domain using 
 * the Gentleman-Sande butterfly. Multiplies by Montgomery factor at the end.
 */
void poly_invntt(poly *r) {
    unsigned int start, len, j, k;
    int16_t t, zeta;
    const int16_t f = 1441; /* mont^2/128 — the INVNTT scaling constant */
    k = 127;
    for (len = 2; len <= 128; len <<= 1) {
        for (start = 0; start < 256; start = j + len) {
            zeta = zetas[k--];
            for (j = start; j < start + len; j++) {
                t = r->coeffs[j];
                r->coeffs[j] = barrett_reduce(t + r->coeffs[j + len]);
                r->coeffs[j + len] = fqmul(zeta, r->coeffs[j + len] - t);
            }
        }
    }
    for (j = 0; j < 256; j++)
        r->coeffs[j] = fqmul(r->coeffs[j], f);
}

void poly_tomont(poly *r) {
    int i;
    const int16_t f = 1353; /* R^2 mod q */
    for (i = 0; i < 256; i++)
        r->coeffs[i] = fqmul(r->coeffs[i], f);
}

void polyvec_ntt(polyvec *a) {
    for (int i = 0; i < MLKEM_K; i++) poly_ntt(&a->vec[i]);
}

void polyvec_invntt(polyvec *a) {
    for (int i = 0; i < MLKEM_K; i++) poly_invntt(&a->vec[i]);
}

void polyvec_ntt_v(polyvec *v) {
    for (int i = 0; i < MLKEM_K; i++) poly_ntt(&v->vec[i]);
}

void polyvec_invntt_v(polyvec *v) {
    for (int i = 0; i < MLKEM_K; i++) poly_invntt(&v->vec[i]);
}

void polyvec_tomont(polyvec *v) {
    for (int i = 0; i < MLKEM_K; i++) poly_tomont(&v->vec[i]);
}

void poly_add(poly *r, const poly *a, const poly *b) {
    for (int i = 0; i < 256; i++) r->coeffs[i] = a->coeffs[i] + b->coeffs[i];
}

void polyvec_add(polyvec *r, const polyvec *a, const polyvec *b) {
    for (int i = 0; i < MLKEM_K; i++) poly_add(&r->vec[i], &a->vec[i], &b->vec[i]);
}

void poly_sub(poly *r, const poly *a, const poly *b) {
    for (int i = 0; i < 256; i++) r->coeffs[i] = a->coeffs[i] - b->coeffs[i];
}

static void basemul(int16_t r[2], const int16_t a[2], const int16_t b[2], int16_t zeta) {
    r[0] = fqmul(a[1], b[1]);
    r[0] = fqmul(r[0], zeta);
    r[0] += fqmul(a[0], b[0]);
    r[1] = fqmul(a[0], b[1]);
    r[1] += fqmul(a[1], b[0]);
}

void poly_basemul_montgomery(poly *r, const poly *a, const poly *b) {
    for (unsigned int i = 0; i < 64; i++) {
        basemul(&r->coeffs[4*i],   &a->coeffs[4*i],   &b->coeffs[4*i],   zetas[64 + i]);
        basemul(&r->coeffs[4*i+2], &a->coeffs[4*i+2], &b->coeffs[4*i+2], -zetas[64 + i]);
    }
}

void polyvec_basemul_acc_montgomery(poly *r, const polyvec *a, const polyvec *b) {
    poly t;
    poly_basemul_montgomery(r, &a->vec[0], &b->vec[0]);
    for (int i = 1; i < MLKEM_K; i++) {
        poly_basemul_montgomery(&t, &a->vec[i], &b->vec[i]);
        poly_add(r, r, &t);
    }
    poly_reduce(r);
}
