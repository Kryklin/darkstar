/**
 * @file ml_kem.c
 * @brief Implementation of ML-KEM-1024 (Kyber) primitives.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#include "ml_kem.h"
#include "api.h"
#include "poly.h"
#include "fips202.h"
#include "rng.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

/** NIST ML-KEM-1024 Parameters (FIPS 203) */
#define MLKEM_ETA1 2
#define MLKEM_ETA2 2
#define MLKEM_POLYVECBYTES 1536

/**
 * @brief Expands the public seed into the A matrix using SHAKE-128.
 * 
 * Implements Algorithm 12 (K-PKE.KeyGen) and Algorithm 13 (K-PKE.Enc) 
 * matrix generation logic from FIPS 203.
 * 
 * @param a Matrix to populate.
 * @param seed The 32-byte public seed (rho).
 * @param transposed flag indicating if the matrix should be transposed.
 */
static void gen_matrix_expand(polyvec *a, const uint8_t seed[32], int transposed) {
    unsigned int i, j;
    uint8_t extseed[34];
    memcpy(extseed, seed, 32);
    for (i = 0; i < MLKEM_K; i++) {
        for (j = 0; j < MLKEM_K; j++) {
            if (transposed) {
                extseed[32] = (uint8_t)i;
                extseed[33] = (uint8_t)j;
            } else {
                extseed[32] = (uint8_t)j;
                extseed[33] = (uint8_t)i;
            }
            poly_getnoise_rej(&a[i].vec[j], extseed, 34);
        }
    }
}

/**
 * @brief Internal PKE encryption primitive (K-PKE.Enc).
 * 
 * @param ct Output ciphertext buffer.
 * @param m 32-byte message to encrypt.
 * @param pk Public key.
 * @param coins Random coins derived from the master seed.
 */
static void crypto_pke_enc(uint8_t *ct, const uint8_t *m, const uint8_t *pk, const uint8_t *coins) {
    polyvec a[MLKEM_K], sp, ep, b;
    poly v, k, epp;
    uint8_t seed[32];
    int i;
    uint8_t nonce = 0;

    memcpy(seed, pk + MLKEM_POLYVECBYTES, 32);
    gen_matrix_expand(a, seed, 1);

    for (i = 0; i < MLKEM_K; i++)
        poly_getnoise_eta1(&sp.vec[i], coins, nonce++);
    for (i = 0; i < MLKEM_K; i++)
        poly_getnoise_eta2(&ep.vec[i], coins, nonce++);
    poly_getnoise_eta2(&epp, coins, nonce++);

    polyvec_ntt(&sp);

    // b = At * sp + ep
    for (i = 0; i < MLKEM_K; i++) {
        polyvec_basemul_acc_montgomery(&b.vec[i], &a[i], &sp);
        poly_invntt(&b.vec[i]); // invntt_tomont
    }

    // v = pk * sp + epp + k
    polyvec pkpv;
    for (i = 0; i < MLKEM_K; i++)
        poly_frombytes(&pkpv.vec[i], pk + i * 384);

    polyvec_basemul_acc_montgomery(&v, &pkpv, &sp);
    poly_invntt(&v);

    polyvec_add(&b, &b, &ep);
    poly_add(&v, &v, &epp);

    // Map message to polynomial
    memset(k.coeffs, 0, sizeof(k.coeffs));
    for (i = 0; i < 32; i++) {
        for (int j = 0; j < 8; j++) {
            if ((m[i] >> j) & 1)
                k.coeffs[8 * i + j] = (Q + 1) / 2;
        }
    }
    poly_add(&v, &v, &k);

    polyvec_reduce(&b);
    poly_reduce(&v);

    for (i = 0; i < MLKEM_K; i++) poly_compress(ct + i * 352, &b.vec[i], 11);
    poly_compress(ct + 1408, &v, 5);
}

/**
 * @brief Core ML-KEM Key Generation (ML-KEM.KeyGen).
 * 
 * Generates a public key (pk) and secret key (sk) according to 
 * Algorithm 15 in FIPS 203.
 * 
 * @param pk Output buffer for the public key.
 * @param sk Output buffer for the secret key.
 * @return 0 on success.
 */
int crypto_kem_keypair(uint8_t *pk, uint8_t *sk) {
    uint8_t d[32], z[32], rho[32], sigma[32];
    uint8_t Kr[64];
    polyvec a[MLKEM_K], s, e, pkvec;
    int i;
    uint8_t nonce = 0;

    randombytes(d, 32);
    randombytes(z, 32);

    sha3_512(Kr, d, 32);
    memcpy(rho, Kr, 32);
    memcpy(sigma, Kr + 32, 32);

    gen_matrix_expand(a, rho, 0);

    for (i = 0; i < MLKEM_K; i++)
        poly_getnoise_eta1(&s.vec[i], sigma, nonce++);
    for (i = 0; i < MLKEM_K; i++)
        poly_getnoise_eta1(&e.vec[i], sigma, nonce++);

    polyvec_ntt(&s);
    polyvec_ntt(&e);

    // t = A * s + e
    for (i = 0; i < MLKEM_K; i++) {
        polyvec_basemul_acc_montgomery(&pkvec.vec[i], &a[i], &s);
        poly_tomont(&pkvec.vec[i]);
    }

    polyvec_add(&pkvec, &pkvec, &e);
    polyvec_reduce(&pkvec);

    // pk = encode(t) || rho
    for (i = 0; i < MLKEM_K; i++) poly_tobytes(pk + i * 384, &pkvec.vec[i]);
    memcpy(pk + MLKEM_POLYVECBYTES, rho, 32);

    // sk = encode(s) || pk || H(pk) || z
    for (i = 0; i < MLKEM_K; i++) poly_tobytes(sk + i * 384, &s.vec[i]);
    memcpy(sk + MLKEM_POLYVECBYTES, pk, 1568);
    sha3_256(sk + 3104, pk, 1568);
    memcpy(sk + 3136, z, 32);

    return 0;
}

/**
 * @brief ML-KEM Encapsulation (ML-KEM.Encaps).
 * 
 * Generates a shared secret and its encapsulation for a given public key 
 * according to Algorithm 16 in FIPS 203.
 * 
 * @param ct Output encapsulation (ciphertext).
 * @param ss Output shared secret.
 * @param pk The public key to encapsulate against.
 * @return 0 on success.
 */
int crypto_kem_enc(uint8_t *ct, uint8_t *ss, const uint8_t *pk) {
    uint8_t m[32], Kr[64], h_pk[32];
    uint8_t K_pre[64];

    randombytes(m, 32);
    sha3_256(h_pk, pk, 1568);
    
    memcpy(K_pre, m, 32);
    memcpy(K_pre + 32, h_pk, 32);
    sha3_512(Kr, K_pre, 64);
    
    crypto_pke_enc(ct, m, pk, Kr + 32);
    memcpy(ss, Kr, 32);
    return 0;
}

/**
 * @brief ML-KEM Decapsulation (ML-KEM.Decaps).
 * 
 * Recovers the shared secret from an encapsulation using a secret key 
 * according to Algorithm 17 in FIPS 203. Implements constant-time 
 * implicit rejection.
 * 
 * @param ss Output buffer for the recovered shared secret.
 * @param ct The received encapsulation.
 * @param sk The secret key.
 * @return 0 on success.
 */
int crypto_kem_dec(uint8_t *ss, const uint8_t *ct, const uint8_t *sk) {
    uint8_t m[32], r[32], Kr[64], K_pre[64];
    uint8_t ct_prime[CRYPTO_CIPHERTEXTBYTES];
    uint8_t h_pk[32];
    int i;
    polyvec s, b, skpv;
    poly v, mp;

    // unpack_ciphertext and sk
    for (i = 0; i < MLKEM_K; i++) {
        poly_frombytes(&skpv.vec[i], sk + i * 384);
        poly_decompress(&b.vec[i], ct + i * 352, 11);
        poly_ntt(&b.vec[i]);
    }
    poly_decompress(&v, ct + 1408, 5);

    // mp = v - sk^t * b
    polyvec_basemul_acc_montgomery(&mp, &skpv, &b);
    poly_invntt(&mp); // invntt_tomont

    poly_sub(&mp, &v, &mp);
    poly_reduce(&mp);

    // Recover message bits
    memset(m, 0, 32);
    for (i = 0; i < 32; i++) {
        for (int j = 0; j < 8; j++) {
            int16_t val = mp.coeffs[8 * i + j];
            val = barrett_reduce(val);
            if (val < 0) val += Q;
            // |val - round(Q/2)| < Q/4
            // dist = min(|val - 1665|, |val - 1665 - Q|, |val - 1665 + Q|)
            uint32_t val32 = (uint32_t)val;
            val32 = (((val32 << 1) + Q / 2) / Q) & 1;
            m[i] |= (uint8_t)(val32 << j);
        }
    }

    memcpy(h_pk, sk + 3104, 32);
    memcpy(K_pre, m, 32);
    memcpy(K_pre + 32, h_pk, 32);
    sha3_512(Kr, K_pre, 64);
    memcpy(r, Kr + 32, 32);

    crypto_pke_enc(ct_prime, m, sk + MLKEM_POLYVECBYTES, r);

    uint32_t fail = 0;
    for(i=0; i<CRYPTO_CIPHERTEXTBYTES; i++) fail |= (ct[i] ^ ct_prime[i]);
    
    // Constant-time mask
    int32_t fail_mask = (int32_t)((int32_t)(fail | -fail) >> 31);

    uint8_t z[32];
    memcpy(z, sk + 3136, 32);
    uint8_t Jz_c[32 + CRYPTO_CIPHERTEXTBYTES];
    memcpy(Jz_c, z, 32); memcpy(Jz_c + 32, ct, CRYPTO_CIPHERTEXTBYTES);
    uint8_t R_rejected[32];
    shake256(R_rejected, 32, Jz_c, 32 + CRYPTO_CIPHERTEXTBYTES);

    for(i=0; i<32; i++) ss[i] = Kr[i] ^ ((uint8_t)fail_mask & (Kr[i] ^ R_rejected[i]));

#ifdef DASP_DIAGNOSTIC
    fprintf(stderr, "{\"diagnostics\":{\"stage0_m_hex\":\"");
    for(int d=0;d<32;d++) fprintf(stderr,"%02x",m[d]);
    fprintf(stderr, "\",\"stage0_fail\":%u}}\n", (unsigned)fail);
    fflush(stderr);
#endif

    return 0;
}
