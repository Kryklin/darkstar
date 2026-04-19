/**
 * @file spna_engine.c
 * @brief Core implementation of the D-ASP (ASP Cascade 16) transformation layers.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 * 
 * See <http://creativecommons.org/publicdomain/zero/1.0/>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "api.h"
#include "sha256.h"
#include "ml_kem.h"

/** 
 * @brief Standard S-Box used for nonlinear transformation layers. 
 * Derived from the Rijndael/AES S-Box for cryptographically proven diffusion.
 */
static const unsigned char SBOX[256] = {
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
};

/** @brief Persistent Inverse S-Box for efficient decryption. */
static unsigned char INV_SBOX[256];
/** @brief Initialization flag for the Inverse S-Box. */
static int inv_sbox_init = 0;

/**
 * @brief PRNG Context for round-path and key derivation.
 * Uses a ChaCha20-based block function for cryptographically secure 
 * deterministic output.
 */
typedef struct {
    uint32_t state[16];  /**< ChaCha base state (Constants + Key + Counter) */
    uint32_t block[16];  /**< Generated random keystream block */
    size_t block_idx;    /**< Current index into the generated block */
} prng_t;

/**
 * @brief Rotates a 32-bit integer left by n bits.
 */
static inline uint32_t rotl32(uint32_t x, int n) {
    return (x << n) | (x >> (32 - n));
}

/**
 * @brief Core ChaCha20 quarter-round transformation.
 */
static void chacha_quarter_round(uint32_t *x, int a, int b, int c, int d) {
    x[a] = x[a] + x[b]; x[d] ^= x[a]; x[d] = rotl32(x[d], 16);
    x[c] = x[c] + x[d]; x[b] ^= x[c]; x[b] = rotl32(x[b], 12);
    x[a] = x[a] + x[b]; x[d] ^= x[a]; x[d] = rotl32(x[d], 8);
    x[c] = x[c] + x[d]; x[b] ^= x[c]; x[b] = rotl32(x[b], 7);
}

/**
 * @brief Generates a single ChaCha20 block (64 bytes).
 */
static void chacha_block(uint32_t *state, uint32_t *out) {
    uint32_t x[16];
    for(int i=0; i<16; i++) x[i] = state[i];
    for (int i = 0; i < 10; i++) {
        chacha_quarter_round(x, 0, 4, 8, 12); chacha_quarter_round(x, 1, 5, 9, 13);
        chacha_quarter_round(x, 2, 6, 10, 14); chacha_quarter_round(x, 3, 7, 11, 15);
        chacha_quarter_round(x, 0, 5, 10, 15); chacha_quarter_round(x, 1, 6, 11, 12);
        chacha_quarter_round(x, 2, 7, 8, 13); chacha_quarter_round(x, 3, 4, 9, 14);
    }
    for(int i=0; i<16; i++) out[i] = x[i] + state[i];
}

/**
 * @brief Initializes the PRNG state using a master seed string.
 * @param ctx Pointer to the PRNG context.
 * @param seed_str Hexadecimal or literal seed string.
 */
static void prng_init(prng_t *ctx, const char *seed_str) {
    uint8_t hash[32];
    crypto_sha256((const uint8_t*)seed_str, strlen(seed_str), hash);
    ctx->state[0] = 0x61707865;
    ctx->state[1] = 0x3320646e;
    ctx->state[2] = 0x79622d32;
    ctx->state[3] = 0x6b206574;
    for (int i = 0; i < 8; i++) {
        ctx->state[4+i] = hash[i*4] | (hash[i*4+1]<<8) | (hash[i*4+2]<<16) | (hash[i*4+3]<<24);
    }
    ctx->state[12] = 0; ctx->state[13] = 0; ctx->state[14] = 0; ctx->state[15] = 0;
    chacha_block(ctx->state, ctx->block);
    ctx->block_idx = 0;
}

/**
 * @brief Retrieves the next 32-bit random integer from the PRNG.
 */
static uint32_t prng_next(prng_t *ctx) {
    if (ctx->block_idx >= 16) {
        ctx->state[12]++;
        chacha_block(ctx->state, ctx->block);
        ctx->block_idx = 0;
    }
    return ctx->block[ctx->block_idx++];
}

/**
 * @brief Constant-time setup for the inverse S-Box.
 */
static void setup_inv_sbox() {
    if(!inv_sbox_init) {
        for(int i=0; i<256; i++) INV_SBOX[SBOX[i]] = i;
        inv_sbox_init = 1;
    }
}

static void t_sbox(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    if(fw) {
        for(size_t i=0; i<len; i++) data[i] = SBOX[data[i]];
    } else {
        setup_inv_sbox();
        for(size_t i=0; i<len; i++) data[i] = INV_SBOX[data[i]];
    }
}

static void t_modmult(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    for(size_t i=0; i<len; i++) {
        data[i] = (uint8_t)(((uint16_t)data[i] * (fw ? 167 : 23)) & 0xFF);
    }
}

static void t_pbox(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    uint8_t *out = malloc(len);
    for(size_t i=0; i<len; i++) {
        uint8_t b = data[i];
        b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4);
        b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2);
        b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1);
        out[len - 1 - i] = b;
    }
    memcpy(data, out, len);
    free(out);
}

static void t_cyclicrot(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    for(size_t i=0; i<len; i++) {
        uint8_t b = data[i];
        if(fw) data[i] = (b >> 3) | (b << 5);
        else data[i] = (b << 3) | (b >> 5);
    }
}

static void t_keyedxor(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    if(!seed || !seed_len) return;
    for(size_t i=0; i<len; i++) data[i] ^= seed[i % seed_len];
}

static void t_feistel(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    size_t half = len / 2;
    if(half == 0 || !seed || !seed_len) return;
    for(size_t i=0; i<half; i++) {
        uint8_t f = (uint8_t)((data[half + i] + seed[i % seed_len]) & 0xFF);
        data[i] ^= f;
    }
}

static void t_modadd(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    if(!seed || !seed_len) return;
    for(size_t i=0; i<len; i++) {
        if(fw) data[i] = (uint8_t)((data[i] + seed[i % seed_len]) & 0xFF);
        else data[i] = (uint8_t)((data[i] - seed[i % seed_len]) & 0xFF);
    }
}

static void t_matrixhill(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    if(len == 0) return;
    if(fw) {
        for(size_t i=1; i<len; i++) data[i] = (uint8_t)((data[i] + data[i-1]) & 0xFF);
    } else {
        for(size_t i=len-1; i>0; i--) data[i] = (uint8_t)((data[i] - data[i-1]) & 0xFF);
    }
}

extern uint8_t d_asp_gf_mult(uint8_t a, uint8_t b);

static void t_gfmult(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    uint8_t factor = fw ? 0x02 : 0x8D;
    for(size_t i=0; i<len; i++) data[i] = d_asp_gf_mult(data[i], factor);
}

static void t_bitflip(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    if(!seed || !seed_len) return;
    for(size_t i=0; i<len; i++) {
        uint8_t mask = seed[i % seed_len];
        data[i] ^= ((mask & 0xAA) | (~mask & 0x55));
    }
}

static void t_columnar(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    uint8_t *out = malloc(len);
    int cols = 3;
    size_t idx = 0;
    if(fw) {
        for(int c=0; c<cols; c++) {
            for(size_t i=c; i<len; i+=cols) out[idx++] = data[i];
        }
    } else {
        for(int c=0; c<cols; c++) {
            for(size_t i=c; i<len; i+=cols) out[i] = data[idx++];
        }
    }
    memcpy(data, out, len);
    free(out);
}

static void t_recxor(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    if(len == 0) return;
    if(fw) {
        for(size_t i=1; i<len; i++) data[i] ^= data[i-1];
    } else {
        for(size_t i=len-1; i>0; i--) data[i] ^= data[i-1];
    }
}

static const uint8_t MDS_MATRIX[4][4] = {
    {0x02, 0x03, 0x01, 0x01},
    {0x01, 0x02, 0x03, 0x01},
    {0x01, 0x01, 0x02, 0x03},
    {0x03, 0x01, 0x01, 0x02}
};

static const uint8_t INV_MDS_MATRIX[4][4] = {
    {0x0E, 0x0B, 0x0D, 0x09},
    {0x09, 0x0E, 0x0B, 0x0D},
    {0x0D, 0x09, 0x0E, 0x0B},
    {0x0B, 0x0D, 0x09, 0x0E}
};

static void t_mds_network(uint8_t *data, size_t len, const uint8_t *seed, size_t seed_len, prng_t *prng, int fw) {
    if(len < 4) {
        t_matrixhill(data, len, seed, seed_len, prng, fw);
        return;
    }
    uint8_t *out = malloc(len);
    for(size_t i=0; i<len; i+=4) {
        if(i + 4 > len) {
            for(size_t j=0; j<len-i; j++) out[i+j] = data[i+j];
            continue;
        }
        for(int row=0; row<4; row++) {
            uint8_t sum = 0;
            for(int col=0; col<4; col++) {
                sum ^= d_asp_gf_mult(data[i+col], fw ? MDS_MATRIX[row][col] : INV_MDS_MATRIX[row][col]);
            }
            out[i+row] = sum;
        }
    }
    memcpy(data, out, len);
    free(out);
}

typedef void (*trans_func)(uint8_t*, size_t, const uint8_t*, size_t, prng_t*, int);

static trans_func funcs[] = {
    t_sbox, t_modmult, t_pbox, t_cyclicrot, t_keyedxor, t_feistel,
    t_modadd, t_matrixhill, t_gfmult, t_bitflip, t_columnar, t_recxor, t_mds_network
};

int dasp_encapsulate_data_inner(uint8_t *base_payload, size_t payload_len, const uint8_t *pk, const uint8_t *hwid, uint8_t *out_ct, uint8_t *out_mac) {
    uint8_t ss[32];
    crypto_kem_enc(out_ct, ss, pk);

    uint8_t blended_ss[32];
    {
        uint8_t content[32 + 64 + 16]; // ss + hwid + "dasp-identity-v3"
        size_t c_len = 0;
        memcpy(content, ss, 32); c_len += 32;
        if(hwid) { memcpy(content + c_len, hwid, 32); c_len += 32; } // Using 32 from hex str config
        memcpy(content + c_len, "dasp-identity-v3", 16); c_len += 16;
        crypto_sha256(content, c_len, blended_ss);
    }

    uint8_t cipher_key[32];
    {
        uint8_t c[38]; memcpy(c, "cipher", 6); memcpy(c+6, blended_ss, 32);
        crypto_sha256(c, 38, cipher_key);
    }
    uint8_t hmac_key[32];
    {
        uint8_t c[36]; memcpy(c, "hmac", 4); memcpy(c+4, blended_ss, 32);
        crypto_sha256(c, 36, hmac_key);
    }
    
    char active_password_str[65];
    for(int i=0; i<32; i++) sprintf(&active_password_str[i*2], "%02x", cipher_key[i]);
    
    memset(ss, 0, 32);

    uint8_t chain_state[32];
    {
        char buf[128];
        sprintf(buf, "dasp-chain-%s", active_password_str);
        crypto_sha256((uint8_t*)buf, strlen(buf), chain_state);
    }

    uint8_t word_key[32];
    crypto_hmac_sha256((uint8_t*)active_password_str, 64, (uint8_t*)"dasp-word-0", 11, word_key);
    
    char word_key_hex[65];
    for(int i=0; i<32; i++) sprintf(&word_key_hex[i*2], "%02x", word_key[i]);

    for(size_t i=0; i<payload_len; i++) base_payload[i] ^= chain_state[i % 32];

    uint8_t func_key[32];
    crypto_hmac_sha256(word_key, 32, (uint8_t*)"keyed-66", 8, func_key);

    prng_t rng;
    prng_init(&rng, word_key_hex);

    size_t group_s[] = {0, 1, 5};
    size_t group_p[] = {2, 3, 10};
    size_t group_n[] = {12, 12, 11};
    size_t group_a[] = {4, 6, 9};

    for(int i=0; i<16; i++) {
        size_t s_idx = (i % 4 == 0) ? 0 : ((i % 4 == 2) ? 1 : group_s[prng_next(&rng) % 3]);
        size_t p_idx = group_p[prng_next(&rng) % 3];
        size_t n_idx = group_n[prng_next(&rng) % 3];
        size_t a_idx = group_a[prng_next(&rng) % 3];

        funcs[s_idx](base_payload, payload_len, func_key, 32, &rng, 1);
        funcs[p_idx](base_payload, payload_len, func_key, 32, &rng, 1);
        funcs[n_idx](base_payload, payload_len, func_key, 32, &rng, 1);
        funcs[a_idx](base_payload, payload_len, func_key, 32, &rng, 1);
    }

    uint8_t *mac_content = malloc(CRYPTO_CIPHERTEXTBYTES + payload_len);
    memcpy(mac_content, out_ct, CRYPTO_CIPHERTEXTBYTES);
    memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES, base_payload, payload_len);
    crypto_hmac_sha256(hmac_key, 32, mac_content, CRYPTO_CIPHERTEXTBYTES + payload_len, out_mac);
    free(mac_content);

    return 0;
}

/**
 * @brief High-level D-ASP decapsulation wrapper.
 * Validates MAC before performing the inverse 16-round cascade and 
 * Recovering the plaintext session key.
 * 
 * @return 0 on success, -1 on integrity/MAC failure.
 */
int dasp_decapsulate_data_inner(uint8_t *base_payload, size_t payload_len, const uint8_t *sk, const uint8_t *hwid, const uint8_t *in_ct, const uint8_t *in_mac) {
    uint8_t ss[32];
    crypto_kem_dec(ss, in_ct, sk);

    uint8_t blended_ss[32];
    {
        uint8_t content[32 + 64 + 16]; 
        size_t c_len = 0;
        memcpy(content, ss, 32); c_len += 32;
        if(hwid) { memcpy(content + c_len, hwid, 32); c_len += 32; } 
        memcpy(content + c_len, "dasp-identity-v3", 16); c_len += 16;
        crypto_sha256(content, c_len, blended_ss);
    }

    uint8_t cipher_key[32];
    {
        uint8_t c[38]; memcpy(c, "cipher", 6); memcpy(c+6, blended_ss, 32);
        crypto_sha256(c, 38, cipher_key);
    }
    uint8_t hmac_key[32];
    {
        uint8_t c[36]; memcpy(c, "hmac", 4); memcpy(c+4, blended_ss, 32);
        crypto_sha256(c, 36, hmac_key);
    }
    
    char active_password_str[65];
    for(int i=0; i<32; i++) sprintf(&active_password_str[i*2], "%02x", cipher_key[i]);
    
    uint8_t word_key[32];
    crypto_hmac_sha256((uint8_t*)active_password_str, 64, (uint8_t*)"dasp-word-0", 11, word_key);
    
    char blended_hex[65], mac_in_hex[65], mac_actual_hex[65];
    for(int i=0; i<32; i++) sprintf(&blended_hex[i*2], "%02x", blended_ss[i]);
    for(int i=0; i<32; i++) sprintf(&mac_in_hex[i*2], "%02x", in_mac[i]);
    
    // We'll update the actual MAC hex after it's calculated below
    
    char word_key_hex[65];
    for(int i=0; i<32; i++) sprintf(&word_key_hex[i*2], "%02x", word_key[i]);

    prng_t rng;
    prng_init(&rng, word_key_hex);

    size_t group_s[] = {0, 1, 5};
    size_t group_p[] = {2, 3, 10};
    size_t group_n[] = {12, 12, 11};
    size_t group_a[] = {4, 6, 9};

    size_t round_paths[16][4];
    for(int i=0; i<16; i++) {
        round_paths[i][0] = (i % 4 == 0) ? 0 : ((i % 4 == 2) ? 1 : group_s[prng_next(&rng) % 3]);
        round_paths[i][1] = group_p[prng_next(&rng) % 3];
        round_paths[i][2] = group_n[prng_next(&rng) % 3];
        round_paths[i][3] = group_a[prng_next(&rng) % 3];
    }

    uint8_t *mac_content = malloc(CRYPTO_CIPHERTEXTBYTES + payload_len);
    memcpy(mac_content, in_ct, CRYPTO_CIPHERTEXTBYTES);
    memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES, base_payload, payload_len);
    uint8_t actual_mac[32];
    crypto_hmac_sha256(hmac_key, 32, mac_content, CRYPTO_CIPHERTEXTBYTES + payload_len, actual_mac);
    free(mac_content);

    for(int i=0; i<32; i++) sprintf(&mac_actual_hex[i*2], "%02x", actual_mac[i]);
    
    fprintf(stderr, "{\"diagnostics\":{\"stage1_blended_ss\":\"%s\",\"stage2_word_key\":\"%s\",\"stage4_mac_in\":\"%s\",\"stage4_mac_actual\":\"%s\"}}\n", 
           blended_hex, word_key_hex, mac_in_hex, mac_actual_hex);
    fflush(stderr);

    uint8_t mac_diff = 0;
    for(int i = 0; i < 32; i++) {
        mac_diff |= in_mac[i] ^ actual_mac[i];
    }
    if(mac_diff != 0) {
        return -1;
    }

    uint8_t func_key[32];
    crypto_hmac_sha256(word_key, 32, (uint8_t*)"keyed-66", 8, func_key);

    for(int j=15; j>=0; j--) {
        size_t s = round_paths[j][0];
        size_t p = round_paths[j][1];
        size_t n = round_paths[j][2];
        size_t a = round_paths[j][3];
        funcs[a](base_payload, payload_len, func_key, 32, &rng, 0);
        funcs[n](base_payload, payload_len, func_key, 32, &rng, 0);
        funcs[p](base_payload, payload_len, func_key, 32, &rng, 0);
        funcs[s](base_payload, payload_len, func_key, 32, &rng, 0);
    }

    uint8_t chain_state[32];
    {
        char buf[128];
        sprintf(buf, "dasp-chain-%s", active_password_str);
        crypto_sha256((uint8_t*)buf, strlen(buf), chain_state);
    }

    for(size_t i=0; i<payload_len; i++) base_payload[i] ^= chain_state[i % 32];

    return 0;
}
