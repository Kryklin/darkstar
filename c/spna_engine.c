/**
 * @file spna_engine.c
 * @brief Core implementation of the D-ASP (ASP Cascade 16) transformation
 * layers.
 *
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/>
 */

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h>
#include <intrin.h>
#define dasp_secure_wipe(ptr, len) SecureZeroMemory(ptr, len)
#else
static void dasp_secure_wipe(void *v, size_t n) {
  volatile uint8_t *p = (volatile uint8_t *)v;
  while (n--)
    *p++ = 0;
}
#endif

#include "api.h"
#include "ml_kem.h"
#include "sha256.h"
#include "sha512.h"
#include <immintrin.h>
#include <stdalign.h>

/**
 * @brief PRNG Context for round-path and key derivation.
 * Uses a ChaCha20-based block function for cryptographically secure
 * deterministic output.
 */
typedef struct {
  uint32_t state[16]; /**< ChaCha base state (Constants + Key + Counter) */
  uint32_t block[16]; /**< Generated random keystream block */
  size_t block_idx;   /**< Current index into the generated block */
} prng_t;

static inline uint32_t rotl32(uint32_t x, int n) {
  return (x << n) | (x >> (32 - n));
}

static void chacha_quarter_round(uint32_t *x, int a, int b, int c, int d) {
  x[a] = x[a] + x[b];
  x[d] ^= x[a];
  x[d] = rotl32(x[d], 16);
  x[c] = x[c] + x[d];
  x[b] ^= x[c];
  x[b] = rotl32(x[b], 12);
  x[a] = x[a] + x[b];
  x[d] ^= x[a];
  x[d] = rotl32(x[d], 8);
  x[c] = x[c] + x[d];
  x[b] ^= x[c];
  x[b] = rotl32(x[b], 7);
}

static void chacha_block(uint32_t *state, uint32_t *out) {
  uint32_t x[16];
  x[0] = state[0]; x[1] = state[1]; x[2] = state[2]; x[3] = state[3];
  x[4] = state[4]; x[5] = state[5]; x[6] = state[6]; x[7] = state[7];
  x[8] = state[8]; x[9] = state[9]; x[10] = state[10]; x[11] = state[11];
  x[12] = state[12]; x[13] = state[13]; x[14] = state[14]; x[15] = state[15];

#define DASP_CHACHA_DOUBLE_ROUND \
    chacha_quarter_round(x, 0, 4, 8, 12); \
    chacha_quarter_round(x, 1, 5, 9, 13); \
    chacha_quarter_round(x, 2, 6, 10, 14); \
    chacha_quarter_round(x, 3, 7, 11, 15); \
    chacha_quarter_round(x, 0, 5, 10, 15); \
    chacha_quarter_round(x, 1, 6, 11, 12); \
    chacha_quarter_round(x, 2, 7, 8, 13); \
    chacha_quarter_round(x, 3, 4, 9, 14);

  DASP_CHACHA_DOUBLE_ROUND; DASP_CHACHA_DOUBLE_ROUND; DASP_CHACHA_DOUBLE_ROUND; DASP_CHACHA_DOUBLE_ROUND; DASP_CHACHA_DOUBLE_ROUND;
  DASP_CHACHA_DOUBLE_ROUND; DASP_CHACHA_DOUBLE_ROUND; DASP_CHACHA_DOUBLE_ROUND; DASP_CHACHA_DOUBLE_ROUND; DASP_CHACHA_DOUBLE_ROUND;

  out[0] = x[0] + state[0]; out[1] = x[1] + state[1]; out[2] = x[2] + state[2]; out[3] = x[3] + state[3];
  out[4] = x[4] + state[4]; out[5] = x[5] + state[5]; out[6] = x[6] + state[6]; out[7] = x[7] + state[7];
  out[8] = x[8] + state[8]; out[9] = x[9] + state[9]; out[10] = x[10] + state[10]; out[11] = x[11] + state[11];
  out[12] = x[12] + state[12]; out[13] = x[13] + state[13]; out[14] = x[14] + state[14]; out[15] = x[15] + state[15];
}

static void prng_init(prng_t *ctx, const char *seed_str) {
  uint8_t hash[64];
  crypto_sha512((const uint8_t *)seed_str, strlen(seed_str), hash);
  for (int i = 0; i < 16; i++) {
    ctx->state[i] = hash[i * 4] | (hash[i * 4 + 1] << 8) |
                    (hash[i * 4 + 2] << 16) | (hash[i * 4 + 3] << 24);
  }
  chacha_block(ctx->state, ctx->block);
  ctx->block_idx = 0;
}

static uint32_t prng_next(prng_t *ctx) {
  if (ctx->block_idx >= 16) {
    ctx->state[12]++;
    chacha_block(ctx->state, ctx->block);
    ctx->block_idx = 0;
  }
  return ctx->block[ctx->block_idx++];
}

static inline uint64_t rotl64_scalar(uint64_t v, int c) {
    return (v << c) | (v >> (64 - c));
}

static inline void dasp_cascade_64_scalar(uint8_t *restrict block, const uint64_t *restrict round_keys);

#ifdef __AVX2__
static inline void dasp_cascade_64_avx2(uint8_t *restrict block, const uint64_t *restrict round_keys) {
    const __m256i *aligned_keys = (const __m256i *)__builtin_assume_aligned(round_keys, 64);
    
    __m256i state_lo = _mm256_loadu_si256((const __m256i *)block);
    __m256i state_hi = _mm256_loadu_si256((const __m256i *)(block + 32));

#define DASP_ROUND_AVX2(r) \
    do { \
        __m256i rk_lo = _mm256_load_si256(&aligned_keys[(r)*2]); \
        __m256i rk_hi = _mm256_load_si256(&aligned_keys[(r)*2 + 1]); \
        state_lo = _mm256_add_epi64(state_lo, rk_lo); \
        state_hi = _mm256_add_epi64(state_hi, rk_hi); \
        __m256i rc = _mm256_set1_epi64x(0x9E3779B97F4A7C15ULL + (r)); \
        state_lo = _mm256_xor_si256(state_lo, rc); \
        state_hi = _mm256_xor_si256(state_hi, rc); \
        __m256i swapped_lo, swapped_hi; \
        if (((r) % 3) == 0) { \
            swapped_lo = state_hi; \
            swapped_hi = state_lo; \
        } else if (((r) % 3) == 1) { \
            swapped_lo = _mm256_permute4x64_epi64(state_lo, _MM_SHUFFLE(1, 0, 3, 2)); \
            swapped_hi = _mm256_permute4x64_epi64(state_hi, _MM_SHUFFLE(1, 0, 3, 2)); \
        } else { \
            swapped_lo = _mm256_permute4x64_epi64(state_lo, _MM_SHUFFLE(2, 3, 0, 1)); \
            swapped_hi = _mm256_permute4x64_epi64(state_hi, _MM_SHUFFLE(2, 3, 0, 1)); \
        } \
        __m256i a_new_lo = _mm256_add_epi64(state_lo, swapped_lo); \
        __m256i a_new_hi = _mm256_add_epi64(state_hi, swapped_hi); \
        __m256i b_new_lo = _mm256_xor_si256(state_lo, a_new_lo); \
        __m256i b_new_hi = _mm256_xor_si256(state_hi, a_new_hi); \
        int rot = (((r) % 4) == 0) ? 32 : ((((r) % 4) == 1) ? 24 : ((((r) % 4) == 2) ? 16 : 14)); \
        __m256i rotl_lo = _mm256_slli_epi64(b_new_lo, rot); \
        __m256i rotr_lo = _mm256_srli_epi64(b_new_lo, 64 - rot); \
        b_new_lo = _mm256_or_si256(rotl_lo, rotr_lo); \
        __m256i rotl_hi = _mm256_slli_epi64(b_new_hi, rot); \
        __m256i rotr_hi = _mm256_srli_epi64(b_new_hi, 64 - rot); \
        b_new_hi = _mm256_or_si256(rotl_hi, rotr_hi); \
        if (((r) % 3) == 0) { \
            state_lo = a_new_lo; \
            state_hi = b_new_hi; \
        } else if (((r) % 3) == 1) { \
            state_lo = _mm256_blend_epi32(a_new_lo, b_new_lo, 0xF0); \
            state_hi = _mm256_blend_epi32(a_new_hi, b_new_hi, 0xF0); \
        } else { \
            state_lo = _mm256_blend_epi32(a_new_lo, b_new_lo, 0xCC); \
            state_hi = _mm256_blend_epi32(a_new_hi, b_new_hi, 0xCC); \
        } \
    } while(0)

    DASP_ROUND_AVX2(0); DASP_ROUND_AVX2(1); DASP_ROUND_AVX2(2); DASP_ROUND_AVX2(3);
    DASP_ROUND_AVX2(4); DASP_ROUND_AVX2(5); DASP_ROUND_AVX2(6); DASP_ROUND_AVX2(7);
    DASP_ROUND_AVX2(8); DASP_ROUND_AVX2(9); DASP_ROUND_AVX2(10); DASP_ROUND_AVX2(11);
    DASP_ROUND_AVX2(12); DASP_ROUND_AVX2(13); DASP_ROUND_AVX2(14); DASP_ROUND_AVX2(15);
#undef DASP_ROUND_AVX2

    _mm256_storeu_si256((__m256i *)block, state_lo);
    _mm256_storeu_si256((__m256i *)(block + 32), state_hi);

    // Zenbleed Mitigation: Force SIMD YMM Register Wipe
    volatile __m256i wipe = _mm256_setzero_si256();
    state_lo = wipe;
    state_hi = wipe;
}
#endif

#if defined(__AVX512F__)
static inline void dasp_cascade_64_avx512(uint8_t *restrict block, const uint64_t *restrict round_keys) {
    const __m512i *aligned_keys = (const __m512i *)__builtin_assume_aligned(round_keys, 64);
    
    __m512i state = _mm512_loadu_si512((const void *)block);

    __m512i perm0 = _mm512_set_epi64(3, 2, 1, 0, 7, 6, 5, 4);
    __m512i perm1 = _mm512_set_epi64(5, 4, 7, 6, 1, 0, 3, 2);
    __m512i perm2 = _mm512_set_epi64(6, 7, 4, 5, 2, 3, 0, 1);

#define DASP_ROUND_AVX512(r) \
    do { \
        __m512i rk = _mm512_load_si512(&aligned_keys[(r)]); \
        state = _mm512_add_epi64(state, rk); \
        __m512i rc = _mm512_set1_epi64(0x9E3779B97F4A7C15ULL + (r)); \
        state = _mm512_xor_si512(state, rc); \
        __m512i swapped; \
        if (((r) % 3) == 0) { \
            swapped = _mm512_permutexvar_epi64(perm0, state); \
        } else if (((r) % 3) == 1) { \
            swapped = _mm512_permutexvar_epi64(perm1, state); \
        } else { \
            swapped = _mm512_permutexvar_epi64(perm2, state); \
        } \
        __m512i a_new = _mm512_add_epi64(state, swapped); \
        __m512i b_new = _mm512_xor_si512(state, a_new); \
        int rot = (((r) % 4) == 0) ? 32 : ((((r) % 4) == 1) ? 24 : ((((r) % 4) == 2) ? 16 : 14)); \
        __m512i rotl = _mm512_slli_epi64(b_new, rot); \
        __m512i rotr = _mm512_srli_epi64(b_new, 64 - rot); \
        b_new = _mm512_or_si512(rotl, rotr); \
        if (((r) % 3) == 0) { \
            state = _mm512_mask_blend_epi64(0xF0, a_new, b_new); \
        } else if (((r) % 3) == 1) { \
            state = _mm512_mask_blend_epi64(0xCC, a_new, b_new); \
        } else { \
            state = _mm512_mask_blend_epi64(0xAA, a_new, b_new); \
        } \
    } while(0)

    DASP_ROUND_AVX512(0); DASP_ROUND_AVX512(1); DASP_ROUND_AVX512(2); DASP_ROUND_AVX512(3);
    DASP_ROUND_AVX512(4); DASP_ROUND_AVX512(5); DASP_ROUND_AVX512(6); DASP_ROUND_AVX512(7);
    DASP_ROUND_AVX512(8); DASP_ROUND_AVX512(9); DASP_ROUND_AVX512(10); DASP_ROUND_AVX512(11);
    DASP_ROUND_AVX512(12); DASP_ROUND_AVX512(13); DASP_ROUND_AVX512(14); DASP_ROUND_AVX512(15);
#undef DASP_ROUND_AVX512

    _mm512_storeu_si512((void *)block, state);

    // Zenbleed Mitigation: Force SIMD ZMM Register Wipe
    volatile __m512i wipe = _mm512_setzero_si512();
    state = wipe;
}
#endif

#if defined(__aarch64__) || defined(__ARM_NEON)
#include <arm_neon.h>
static inline void dasp_cascade_64_neon(uint8_t *restrict block, const uint64_t *restrict round_keys) {
    uint64x2_t state0 = vld1q_u64((const uint64_t *)block);
    uint64x2_t state1 = vld1q_u64((const uint64_t *)(block + 16));
    uint64x2_t state2 = vld1q_u64((const uint64_t *)(block + 32));
    uint64x2_t state3 = vld1q_u64((const uint64_t *)(block + 48));

#define DASP_ROUND_NEON(r) \
    do { \
        uint64x2_t rk0 = vld1q_u64(&round_keys[(r) * 8]); \
        uint64x2_t rk1 = vld1q_u64(&round_keys[(r) * 8 + 2]); \
        uint64x2_t rk2 = vld1q_u64(&round_keys[(r) * 8 + 4]); \
        uint64x2_t rk3 = vld1q_u64(&round_keys[(r) * 8 + 6]); \
        state0 = vaddq_u64(state0, rk0); \
        state1 = vaddq_u64(state1, rk1); \
        state2 = vaddq_u64(state2, rk2); \
        state3 = vaddq_u64(state3, rk3); \
        uint64x2_t rc = vdupq_n_u64(0x9E3779B97F4A7C15ULL + (r)); \
        state0 = veorq_u64(state0, rc); \
        state1 = veorq_u64(state1, rc); \
        state2 = veorq_u64(state2, rc); \
        state3 = veorq_u64(state3, rc); \
        uint64x2_t sw0, sw1, sw2, sw3; \
        if (((r) % 3) == 0) { \
            sw0 = state2; sw1 = state3; sw2 = state0; sw3 = state1; \
        } else if (((r) % 3) == 1) { \
            sw0 = state1; sw1 = state0; sw2 = state3; sw3 = state2; \
        } else { \
            sw0 = vcombine_u64(vget_high_u64(state0), vget_low_u64(state0)); \
            sw1 = vcombine_u64(vget_high_u64(state1), vget_low_u64(state1)); \
            sw2 = vcombine_u64(vget_high_u64(state2), vget_low_u64(state2)); \
            sw3 = vcombine_u64(vget_high_u64(state3), vget_low_u64(state3)); \
        } \
        uint64x2_t a0 = vaddq_u64(state0, sw0); \
        uint64x2_t a1 = vaddq_u64(state1, sw1); \
        uint64x2_t a2 = vaddq_u64(state2, sw2); \
        uint64x2_t a3 = vaddq_u64(state3, sw3); \
        uint64x2_t b0 = veorq_u64(state0, a0); \
        uint64x2_t b1 = veorq_u64(state1, a1); \
        uint64x2_t b2 = veorq_u64(state2, a2); \
        uint64x2_t b3 = veorq_u64(state3, a3); \
        uint64x2_t rotl0, rotl1, rotl2, rotl3, b_final0, b_final1, b_final2, b_final3; \
        if (((r) % 4) == 0) { \
            rotl0 = vshlq_n_u64(b0, 32); b_final0 = vsriq_n_u64(rotl0, b0, 32); \
            rotl1 = vshlq_n_u64(b1, 32); b_final1 = vsriq_n_u64(rotl1, b1, 32); \
            rotl2 = vshlq_n_u64(b2, 32); b_final2 = vsriq_n_u64(rotl2, b2, 32); \
            rotl3 = vshlq_n_u64(b3, 32); b_final3 = vsriq_n_u64(rotl3, b3, 32); \
        } else if (((r) % 4) == 1) { \
            rotl0 = vshlq_n_u64(b0, 24); b_final0 = vsriq_n_u64(rotl0, b0, 40); \
            rotl1 = vshlq_n_u64(b1, 24); b_final1 = vsriq_n_u64(rotl1, b1, 40); \
            rotl2 = vshlq_n_u64(b2, 24); b_final2 = vsriq_n_u64(rotl2, b2, 40); \
            rotl3 = vshlq_n_u64(b3, 24); b_final3 = vsriq_n_u64(rotl3, b3, 40); \
        } else if (((r) % 4) == 2) { \
            rotl0 = vshlq_n_u64(b0, 16); b_final0 = vsriq_n_u64(rotl0, b0, 48); \
            rotl1 = vshlq_n_u64(b1, 16); b_final1 = vsriq_n_u64(rotl1, b1, 48); \
            rotl2 = vshlq_n_u64(b2, 16); b_final2 = vsriq_n_u64(rotl2, b2, 48); \
            rotl3 = vshlq_n_u64(b3, 16); b_final3 = vsriq_n_u64(rotl3, b3, 48); \
        } else { \
            rotl0 = vshlq_n_u64(b0, 14); b_final0 = vsriq_n_u64(rotl0, b0, 50); \
            rotl1 = vshlq_n_u64(b1, 14); b_final1 = vsriq_n_u64(rotl1, b1, 50); \
            rotl2 = vshlq_n_u64(b2, 14); b_final2 = vsriq_n_u64(rotl2, b2, 50); \
            rotl3 = vshlq_n_u64(b3, 14); b_final3 = vsriq_n_u64(rotl3, b3, 50); \
        } \
        if (((r) % 3) == 0) { \
            state0 = a0; state1 = a1; \
            state2 = b_final2; state3 = b_final3; \
        } else if (((r) % 3) == 1) { \
            state0 = a0; state1 = b_final1; \
            state2 = a2; state3 = b_final3; \
        } else { \
            state0 = vcombine_u64(vget_low_u64(a0), vget_high_u64(b_final0)); \
            state1 = vcombine_u64(vget_low_u64(a1), vget_high_u64(b_final1)); \
            state2 = vcombine_u64(vget_low_u64(a2), vget_high_u64(b_final2)); \
            state3 = vcombine_u64(vget_low_u64(a3), vget_high_u64(b_final3)); \
        } \
    } while(0)

    DASP_ROUND_NEON(0); DASP_ROUND_NEON(1); DASP_ROUND_NEON(2); DASP_ROUND_NEON(3);
    DASP_ROUND_NEON(4); DASP_ROUND_NEON(5); DASP_ROUND_NEON(6); DASP_ROUND_NEON(7);
    DASP_ROUND_NEON(8); DASP_ROUND_NEON(9); DASP_ROUND_NEON(10); DASP_ROUND_NEON(11);
    DASP_ROUND_NEON(12); DASP_ROUND_NEON(13); DASP_ROUND_NEON(14); DASP_ROUND_NEON(15);
#undef DASP_ROUND_NEON

    vst1q_u64((uint64_t *)block, state0);
    vst1q_u64((uint64_t *)(block + 16), state1);
    vst1q_u64((uint64_t *)(block + 32), state2);
    vst1q_u64((uint64_t *)(block + 48), state3);

    // Zenbleed Mitigation: Force SIMD Q Register Wipe
    volatile uint64x2_t wipe = vdupq_n_u64(0);
    state0 = wipe; state1 = wipe; state2 = wipe; state3 = wipe;
}
#endif

static inline void dasp_cascade_64_scalar(uint8_t *restrict block, const uint64_t *restrict round_keys) {
    uint64_t state[8];
    for(int i=0; i<8; i++) {
        state[i] = ((uint64_t)block[i*8]) | ((uint64_t)block[i*8+1] << 8) | 
                   ((uint64_t)block[i*8+2] << 16) | ((uint64_t)block[i*8+3] << 24) |
                   ((uint64_t)block[i*8+4] << 32) | ((uint64_t)block[i*8+5] << 40) |
                   ((uint64_t)block[i*8+6] << 48) | ((uint64_t)block[i*8+7] << 56);
    }
    
#define DASP_ROUND_SCALAR(r) \
    do { \
        state[0] += round_keys[(r)*8 + 0]; state[1] += round_keys[(r)*8 + 1]; \
        state[2] += round_keys[(r)*8 + 2]; state[3] += round_keys[(r)*8 + 3]; \
        state[4] += round_keys[(r)*8 + 4]; state[5] += round_keys[(r)*8 + 5]; \
        state[6] += round_keys[(r)*8 + 6]; state[7] += round_keys[(r)*8 + 7]; \
        uint64_t rc = 0x9E3779B97F4A7C15ULL + (r); \
        state[0] ^= rc; state[1] ^= rc; state[2] ^= rc; state[3] ^= rc; \
        state[4] ^= rc; state[5] ^= rc; state[6] ^= rc; state[7] ^= rc; \
        uint64_t swapped[8]; \
        if ((r) % 3 == 0) { \
            swapped[0] = state[4]; swapped[1] = state[5]; swapped[2] = state[6]; swapped[3] = state[7]; \
            swapped[4] = state[0]; swapped[5] = state[1]; swapped[6] = state[2]; swapped[7] = state[3]; \
        } else if ((r) % 3 == 1) { \
            swapped[0] = state[2]; swapped[1] = state[3]; swapped[2] = state[0]; swapped[3] = state[1]; \
            swapped[4] = state[6]; swapped[5] = state[7]; swapped[6] = state[4]; swapped[7] = state[5]; \
        } else { \
            swapped[0] = state[1]; swapped[1] = state[0]; swapped[2] = state[3]; swapped[3] = state[2]; \
            swapped[4] = state[5]; swapped[5] = state[4]; swapped[6] = state[7]; swapped[7] = state[6]; \
        } \
        uint64_t a_new[8], b_new[8]; \
        a_new[0] = state[0] + swapped[0]; b_new[0] = state[0] ^ a_new[0]; \
        a_new[1] = state[1] + swapped[1]; b_new[1] = state[1] ^ a_new[1]; \
        a_new[2] = state[2] + swapped[2]; b_new[2] = state[2] ^ a_new[2]; \
        a_new[3] = state[3] + swapped[3]; b_new[3] = state[3] ^ a_new[3]; \
        a_new[4] = state[4] + swapped[4]; b_new[4] = state[4] ^ a_new[4]; \
        a_new[5] = state[5] + swapped[5]; b_new[5] = state[5] ^ a_new[5]; \
        a_new[6] = state[6] + swapped[6]; b_new[6] = state[6] ^ a_new[6]; \
        a_new[7] = state[7] + swapped[7]; b_new[7] = state[7] ^ a_new[7]; \
        int rot = ((r) % 4 == 0) ? 32 : (((r) % 4 == 1) ? 24 : (((r) % 4 == 2) ? 16 : 14)); \
        b_new[0] = rotl64_scalar(b_new[0], rot); b_new[1] = rotl64_scalar(b_new[1], rot); \
        b_new[2] = rotl64_scalar(b_new[2], rot); b_new[3] = rotl64_scalar(b_new[3], rot); \
        b_new[4] = rotl64_scalar(b_new[4], rot); b_new[5] = rotl64_scalar(b_new[5], rot); \
        b_new[6] = rotl64_scalar(b_new[6], rot); b_new[7] = rotl64_scalar(b_new[7], rot); \
        if ((r) % 3 == 0) { \
            state[0] = a_new[0]; state[1] = a_new[1]; state[2] = a_new[2]; state[3] = a_new[3]; \
            state[4] = b_new[4]; state[5] = b_new[5]; state[6] = b_new[6]; state[7] = b_new[7]; \
        } else if ((r) % 3 == 1) { \
            state[0] = a_new[0]; state[1] = a_new[1]; state[2] = b_new[2]; state[3] = b_new[3]; \
            state[4] = a_new[4]; state[5] = a_new[5]; state[6] = b_new[6]; state[7] = b_new[7]; \
        } else { \
            state[0] = a_new[0]; state[1] = b_new[1]; state[2] = a_new[2]; state[3] = b_new[3]; \
            state[4] = a_new[4]; state[5] = b_new[5]; state[6] = a_new[6]; state[7] = b_new[7]; \
        } \
    } while(0)

    DASP_ROUND_SCALAR(0); DASP_ROUND_SCALAR(1); DASP_ROUND_SCALAR(2); DASP_ROUND_SCALAR(3);
    DASP_ROUND_SCALAR(4); DASP_ROUND_SCALAR(5); DASP_ROUND_SCALAR(6); DASP_ROUND_SCALAR(7);
    DASP_ROUND_SCALAR(8); DASP_ROUND_SCALAR(9); DASP_ROUND_SCALAR(10); DASP_ROUND_SCALAR(11);
    DASP_ROUND_SCALAR(12); DASP_ROUND_SCALAR(13); DASP_ROUND_SCALAR(14); DASP_ROUND_SCALAR(15);
#undef DASP_ROUND_SCALAR
    
    for(int i=0; i<8; i++) {
        block[i*8] = state[i] & 0xFF;
        block[i*8+1] = (state[i] >> 8) & 0xFF;
        block[i*8+2] = (state[i] >> 16) & 0xFF;
        block[i*8+3] = (state[i] >> 24) & 0xFF;
        block[i*8+4] = (state[i] >> 32) & 0xFF;
        block[i*8+5] = (state[i] >> 40) & 0xFF;
        block[i*8+6] = (state[i] >> 48) & 0xFF;
        block[i*8+7] = (state[i] >> 56) & 0xFF;
    }
}

static inline void dasp_cascade_64(uint8_t *restrict block, const uint64_t *restrict round_keys) {
#if defined(__AVX512F__)
    dasp_cascade_64_avx512(block, round_keys);
    return;
#endif
#if defined(__AVX2__)
    dasp_cascade_64_avx2(block, round_keys);
    return;
#elif defined(__aarch64__) || defined(__ARM_NEON)
    dasp_cascade_64_neon(block, round_keys);
    return;
#endif
    dasp_cascade_64_scalar(block, round_keys);
}

static uint64_t dpa_history[10] = {0};
static int dpa_idx = 0;

static uint64_t fnv1a_64(const uint8_t *data, size_t len) {
  uint64_t hash = 14695981039346656037ULL;
  for (size_t i = 0; i < len; i++) {
    hash ^= data[i];
    hash *= 1099511628211ULL;
  }
  return hash;
}

static int check_dpa_pattern(uint64_t sig) {
  if (sig == 0) return 0;
  
  int idx = dpa_idx % 10;
  dpa_history[idx] = sig;
  dpa_idx++;

  int matches = 0;
  int consecutive = 0;
  int last_was_match = 0;

  for (int i = 0; i < 10; i++) {
    uint64_t hist_val = dpa_history[i];
    if (hist_val == sig && sig != 0) {
      matches++;
      if (last_was_match || consecutive == 0) {
        consecutive++;
      }
      last_was_match = 1;
    } else {
      last_was_match = 0;
      consecutive = 0;
    }
  }

  return (consecutive >= 5 || matches >= 5) ? 1 : 0;
}

int dasp_encapsulate_data_inner(uint8_t *base_payload, size_t payload_len,
                                const uint8_t *pk, const uint8_t *hwid,
                                uint8_t *out_ct, uint8_t *out_mac, uint64_t ts, int has_ts) {
  ml_kem_verify_constants();
  // ---------------------------------------------------------
  // PHASE 1: KEM Encapsulation & Shared Secret Generation
  // ---------------------------------------------------------
  uint8_t ss[32];
  crypto_kem_enc(out_ct, ss, pk);

  // ---------------------------------------------------------
  // PHASE 2: Hardware ID Binding (HKDF-like Expand)
  // ---------------------------------------------------------

  uint8_t blended_ss[32];
  {
    uint8_t prk[32];
    if (hwid) {
      crypto_hmac_sha256(hwid, 32, ss, 32, prk);
    } else {
      uint8_t empty_salt[32] = {0};
      crypto_hmac_sha256(empty_salt, 32, ss, 32, prk);
    }
    uint8_t expand_info[17];
    memcpy(expand_info, "dasp-identity-v3", 16);
    expand_info[16] = 0x01;
    crypto_hmac_sha256(prk, 32, expand_info, 17, blended_ss);
  }

  // ---------------------------------------------------------
  // PHASE 3: Subkey Derivation (Cipher & HMAC Keys)
  // ---------------------------------------------------------
  uint8_t cipher_key[32];
  {
    uint8_t c[38];
    memcpy(c, "cipher", 6);
    memcpy(c + 6, blended_ss, 32);
    crypto_sha256(c, 38, cipher_key);
  }
  uint8_t hmac_key[32];
  {
    uint8_t c[36];
    memcpy(c, "hmac", 4);
    memcpy(c + 4, blended_ss, 32);
    crypto_sha256(c, 36, hmac_key);
  }

  char active_password_str[65];
  for (int i = 0; i < 32; i++)
    sprintf(&active_password_str[i * 2], "%02x", cipher_key[i]);

  memset(ss, 0, 32);

  uint8_t chain_state[64];
  {
    char buf[256];
    sprintf(buf, "dasp-chain-%s", active_password_str);
    crypto_sha512((uint8_t *)buf, strlen(buf), chain_state);
  }

  uint8_t word_key[32];
  crypto_hmac_sha256((uint8_t *)active_password_str, 64,
                     (uint8_t *)"dasp-word-0", 11, word_key);

  char word_key_hex[65];
  for (int i = 0; i < 32; i++)
    sprintf(&word_key_hex[i * 2], "%02x", word_key[i]);

  prng_t rng;
  prng_init(&rng, word_key_hex);

  alignas(64) uint64_t round_keys[128];
  for (int i = 0; i < 128; i++) {
    uint32_t lo = prng_next(&rng);
    uint32_t hi = prng_next(&rng);
    round_keys[i] = ((uint64_t)hi << 32) | lo;
  }

  alignas(64) uint8_t nonce[64];
  memcpy(nonce, chain_state, 64);

  // --- DPA Signature ---
  uint8_t sig_buf[64] = {0};
  memcpy(sig_buf, blended_ss, 32);
  size_t p_prefix = payload_len > 32 ? 32 : payload_len;
  memcpy(sig_buf + 32, base_payload, p_prefix);
  uint64_t sig = fnv1a_64(sig_buf, 32 + p_prefix);
  check_dpa_pattern(sig);

  // ---------------------------------------------------------
  // PHASE 4: Block Encryption (D-ASP Cascade 16)
  // ---------------------------------------------------------
  for (size_t i = 0; i < payload_len; i += 64) {
    alignas(64) uint8_t block[64];
    memcpy(block, nonce, 64);
    dasp_cascade_64(block, round_keys);

    size_t chunk = (payload_len - i < 64) ? (payload_len - i) : 64;
    if (chunk == 64) {
      uint64_t *base_ptr = (uint64_t *)(base_payload + i);
      const uint64_t *block_ptr = (const uint64_t *)block;
      base_ptr[0] ^= block_ptr[0]; base_ptr[1] ^= block_ptr[1];
      base_ptr[2] ^= block_ptr[2]; base_ptr[3] ^= block_ptr[3];
      base_ptr[4] ^= block_ptr[4]; base_ptr[5] ^= block_ptr[5];
      base_ptr[6] ^= block_ptr[6]; base_ptr[7] ^= block_ptr[7];
    } else {
      for (size_t j = 0; j < chunk; j++) {
        base_payload[i + j] ^= block[j];
      }
    }

    uint64_t carry = 1;
    uint64_t *ptr = (uint64_t *)nonce;
    for (int j = 7; j >= 0; j--) {
      uint64_t val = _byteswap_uint64(ptr[j]);
      uint64_t sum = val + carry;
      carry = (sum < val) ? 1 : 0;
      ptr[j] = _byteswap_uint64(sum);
    }
  }

  size_t mac_content_len = CRYPTO_CIPHERTEXTBYTES + payload_len + (has_ts ? 8 : 0);
  uint8_t *mac_content = malloc(mac_content_len);
  memcpy(mac_content, out_ct, CRYPTO_CIPHERTEXTBYTES);
  memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES, base_payload, payload_len);
  if (has_ts) {
    uint8_t ts_be[8];
    ts_be[0] = (ts >> 56) & 0xFF; ts_be[1] = (ts >> 48) & 0xFF;
    ts_be[2] = (ts >> 40) & 0xFF; ts_be[3] = (ts >> 32) & 0xFF;
    ts_be[4] = (ts >> 24) & 0xFF; ts_be[5] = (ts >> 16) & 0xFF;
    ts_be[6] = (ts >> 8) & 0xFF;  ts_be[7] = ts & 0xFF;
    memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES + payload_len, ts_be, 8);
  }
  crypto_hmac_sha256(hmac_key, 32, mac_content, mac_content_len, out_mac);
  free(mac_content);

  dasp_secure_wipe(blended_ss, 32);
  dasp_secure_wipe(cipher_key, 32);
  dasp_secure_wipe(hmac_key, 32);
  dasp_secure_wipe(chain_state, 32);
  dasp_secure_wipe(word_key, 32);
  dasp_secure_wipe(active_password_str, 65);
  dasp_secure_wipe(word_key_hex, 65);
  dasp_secure_wipe(round_keys, sizeof(round_keys));

  return 0;
}

int dasp_decapsulate_data_inner(uint8_t *base_payload, size_t payload_len,
                                const uint8_t *sk, const uint8_t *hwid,
                                const uint8_t *in_ct, const uint8_t *in_mac, uint64_t ts, int has_ts) {
  ml_kem_verify_constants();
  // ---------------------------------------------------------
  // PHASE 1: KEM Decapsulation & Shared Secret Recovery
  // ---------------------------------------------------------
  uint8_t ss[32];
  crypto_kem_dec(ss, in_ct, sk);

  // ---------------------------------------------------------
  // PHASE 2: Hardware ID Binding Verification
  // ---------------------------------------------------------
  uint8_t blended_ss[32];
  {
    uint8_t prk[32];
    if (hwid) {
      crypto_hmac_sha256(hwid, 32, ss, 32, prk);
    } else {
      uint8_t empty_salt[32] = {0};
      crypto_hmac_sha256(empty_salt, 32, ss, 32, prk);
    }
    uint8_t expand_info[17];
    memcpy(expand_info, "dasp-identity-v3", 16);
    expand_info[16] = 0x01;
    crypto_hmac_sha256(prk, 32, expand_info, 17, blended_ss);
  }

  // ---------------------------------------------------------
  // PHASE 3: Subkey Derivation & MAC Verification
  // ---------------------------------------------------------
  uint8_t cipher_key[32];
  {
    uint8_t c[38];
    memcpy(c, "cipher", 6);
    memcpy(c + 6, blended_ss, 32);
    crypto_sha256(c, 38, cipher_key);
  }
  uint8_t hmac_key[32];
  {
    uint8_t c[36];
    memcpy(c, "hmac", 4);
    memcpy(c + 4, blended_ss, 32);
    crypto_sha256(c, 36, hmac_key);
  }

  char active_password_str[65];
  for (int i = 0; i < 32; i++)
    sprintf(&active_password_str[i * 2], "%02x", cipher_key[i]);

  uint8_t word_key[32];
  crypto_hmac_sha256((uint8_t *)active_password_str, 64,
                     (uint8_t *)"dasp-word-0", 11, word_key);

  char word_key_hex[65];
  for (int i = 0; i < 32; i++)
    sprintf(&word_key_hex[i * 2], "%02x", word_key[i]);

  size_t mac_content_len = CRYPTO_CIPHERTEXTBYTES + payload_len + (has_ts ? 8 : 0);
  uint8_t *mac_content = malloc(mac_content_len);
  memcpy(mac_content, in_ct, CRYPTO_CIPHERTEXTBYTES);
  memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES, base_payload, payload_len);
  if (has_ts) {
    uint8_t ts_be[8];
    ts_be[0] = (ts >> 56) & 0xFF; ts_be[1] = (ts >> 48) & 0xFF;
    ts_be[2] = (ts >> 40) & 0xFF; ts_be[3] = (ts >> 32) & 0xFF;
    ts_be[4] = (ts >> 24) & 0xFF; ts_be[5] = (ts >> 16) & 0xFF;
    ts_be[6] = (ts >> 8) & 0xFF;  ts_be[7] = ts & 0xFF;
    memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES + payload_len, ts_be, 8);
  }
  uint8_t actual_mac[32];
  crypto_hmac_sha256(hmac_key, 32, mac_content, mac_content_len, actual_mac);
  free(mac_content);

  uint8_t mac_diff = 0;
  volatile uint8_t mac_diff_fi = 0;
  for (int i = 0; i < 32; i++) {
    mac_diff |= (in_mac[i] ^ actual_mac[i]);
    mac_diff_fi |= (in_mac[i] ^ actual_mac[i]);
  }
  if (mac_diff != 0 || mac_diff_fi != 0) {
    
    dasp_secure_wipe(hmac_key, 32);

#if defined(__aarch64__) || defined(__ARM_NEON)
  #ifdef _MSC_VER
    __isb(_ARM64_BARRIER_SY);
  #else
    __asm__ volatile("isb\n\tcsdb" ::: "memory");
  #endif
#else
  #ifdef _MSC_VER
    _mm_lfence();
  #else
    __asm__ volatile("lfence" ::: "memory");
  #endif
#endif
    return -1;
  }

#if defined(__aarch64__) || defined(__ARM_NEON)
  #ifdef _MSC_VER
    __isb(_ARM64_BARRIER_SY);
  #else
    __asm__ volatile("isb\n\tcsdb" ::: "memory");
  #endif
#else
  #ifdef _MSC_VER
    _mm_lfence();
  #else
    __asm__ volatile("lfence" ::: "memory");
  #endif
#endif

  // ---------------------------------------------------------
  // PHASE 4: Block Decryption (D-ASP Cascade 16)
  // ---------------------------------------------------------
  // MAC passed, proceed with decryption (CTR is symmetric)
  uint8_t chain_state[64];
  {
    char buf[256];
    sprintf(buf, "dasp-chain-%s", active_password_str);
    crypto_sha512((uint8_t *)buf, strlen(buf), chain_state);
  }

  prng_t rng;
  prng_init(&rng, word_key_hex);

  alignas(64) uint64_t round_keys[128];
  for (int i = 0; i < 128; i++) {
    uint32_t lo = prng_next(&rng);
    uint32_t hi = prng_next(&rng);
    round_keys[i] = ((uint64_t)hi << 32) | lo;
  }

  alignas(64) uint8_t nonce[64];
  memcpy(nonce, chain_state, 64);

  // --- DPA Signature ---
  uint8_t sig_buf[64] = {0};
  memcpy(sig_buf, blended_ss, 32);
  size_t p_prefix = payload_len > 32 ? 32 : payload_len;
  memcpy(sig_buf + 32, base_payload, p_prefix); // using ciphertext bytes
  uint64_t sig = fnv1a_64(sig_buf, 32 + p_prefix);
  int dpa_triggered = check_dpa_pattern(sig);

  for (size_t i = 0; i < payload_len; i += 64) {
    alignas(64) uint8_t block[64];
    memcpy(block, nonce, 64);
    dasp_cascade_64(block, round_keys);

    size_t chunk = (payload_len - i < 64) ? (payload_len - i) : 64;
    if (chunk == 64) {
      uint64_t *base_ptr = (uint64_t *)(base_payload + i);
      const uint64_t *block_ptr = (const uint64_t *)block;
      base_ptr[0] ^= block_ptr[0]; base_ptr[1] ^= block_ptr[1];
      base_ptr[2] ^= block_ptr[2]; base_ptr[3] ^= block_ptr[3];
      base_ptr[4] ^= block_ptr[4]; base_ptr[5] ^= block_ptr[5];
      base_ptr[6] ^= block_ptr[6]; base_ptr[7] ^= block_ptr[7];
    } else {
      for (size_t j = 0; j < chunk; j++) {
        base_payload[i + j] ^= block[j];
      }
    }

    uint64_t carry = 1;
    uint64_t *ptr = (uint64_t *)nonce;
    for (int j = 7; j >= 0; j--) {
      uint64_t val = _byteswap_uint64(ptr[j]);
      uint64_t sum = val + carry;
      carry = (sum < val) ? 1 : 0;
      ptr[j] = _byteswap_uint64(sum);
    }
  }

  if (dpa_triggered) {
    for (size_t k = 0; k < payload_len; k++) {
      base_payload[k] ^= (uint8_t)prng_next(&rng);
    }
    dasp_secure_wipe(blended_ss, 32);
    dasp_secure_wipe(cipher_key, 32);
    dasp_secure_wipe(hmac_key, 32);
    dasp_secure_wipe(chain_state, 64);
    dasp_secure_wipe(word_key, 32);
    dasp_secure_wipe(active_password_str, 65);
    dasp_secure_wipe(word_key_hex, 65);
    dasp_secure_wipe(round_keys, sizeof(round_keys));
    return -2;
  }

  dasp_secure_wipe(blended_ss, 32);
  dasp_secure_wipe(cipher_key, 32);
  dasp_secure_wipe(hmac_key, 32);
  dasp_secure_wipe(chain_state, 64);
  dasp_secure_wipe(word_key, 32);
  dasp_secure_wipe(active_password_str, 65);
  dasp_secure_wipe(word_key_hex, 65);
  dasp_secure_wipe(round_keys, sizeof(round_keys));

  return 0;
}
