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
  for (int i = 0; i < 16; i++)
    x[i] = state[i];
  for (int i = 0; i < 10; i++) {
    chacha_quarter_round(x, 0, 4, 8, 12);
    chacha_quarter_round(x, 1, 5, 9, 13);
    chacha_quarter_round(x, 2, 6, 10, 14);
    chacha_quarter_round(x, 3, 7, 11, 15);
    chacha_quarter_round(x, 0, 5, 10, 15);
    chacha_quarter_round(x, 1, 6, 11, 12);
    chacha_quarter_round(x, 2, 7, 8, 13);
    chacha_quarter_round(x, 3, 4, 9, 14);
  }
  for (int i = 0; i < 16; i++)
    out[i] = x[i] + state[i];
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

#ifdef _MSC_VER
__forceinline
#else
__attribute__((always_inline))
#endif
static inline void dasp_cascade_32_avx2(uint8_t *restrict block,
                                        const uint32_t *restrict round_keys) {
  const __m256i *aligned_keys =
      (const __m256i *)__builtin_assume_aligned(round_keys, 32);

  __m256i state = _mm256_loadu_si256((const __m256i *)block);

#define DASP_ROUND_AVX2(r)                                                     \
  do {                                                                         \
    __m256i rk = _mm256_load_si256(&aligned_keys[r]);                          \
    state = _mm256_add_epi32(state, rk);                                       \
    __m256i rc = _mm256_set1_epi32(0x9E3779B9 + (r));                          \
    state = _mm256_xor_si256(state, rc);                                       \
                                                                               \
    __m256i swapped;                                                           \
    if (((r) % 3) == 0)                                                        \
      swapped = _mm256_permutevar8x32_epi32(                                   \
          state, _mm256_set_epi32(3, 2, 1, 0, 7, 6, 5, 4));                    \
    else if (((r) % 3) == 1)                                                   \
      swapped = _mm256_permutevar8x32_epi32(                                   \
          state, _mm256_set_epi32(5, 4, 7, 6, 1, 0, 3, 2));                    \
    else                                                                       \
      swapped = _mm256_permutevar8x32_epi32(                                   \
          state, _mm256_set_epi32(6, 7, 4, 5, 2, 3, 0, 1));                    \
                                                                               \
    __m256i A_new = _mm256_add_epi32(state, swapped);                          \
    __m256i B_new = _mm256_xor_si256(state, A_new);                            \
                                                                               \
    int rot = (((r) % 4) == 0)                                                 \
                  ? 16                                                         \
                  : ((((r) % 4) == 1) ? 12 : ((((r) % 4) == 2) ? 8 : 7));      \
    __m256i rotl = _mm256_slli_epi32(B_new, rot);                              \
    __m256i rotr = _mm256_srli_epi32(B_new, 32 - rot);                         \
    B_new = _mm256_or_si256(rotl, rotr);                                       \
                                                                               \
    if (((r) % 3) == 0)                                                        \
      state = _mm256_blend_epi32(A_new, B_new, 0xF0);                          \
    else if (((r) % 3) == 1)                                                   \
      state = _mm256_blend_epi32(A_new, B_new, 0xCC);                          \
    else                                                                       \
      state = _mm256_blend_epi32(A_new, B_new, 0xAA);                          \
  } while (0)

  DASP_ROUND_AVX2(0);
  DASP_ROUND_AVX2(1);
  DASP_ROUND_AVX2(2);
  DASP_ROUND_AVX2(3);
  DASP_ROUND_AVX2(4);
  DASP_ROUND_AVX2(5);
  DASP_ROUND_AVX2(6);
  DASP_ROUND_AVX2(7);
  DASP_ROUND_AVX2(8);
  DASP_ROUND_AVX2(9);
  DASP_ROUND_AVX2(10);
  DASP_ROUND_AVX2(11);
  DASP_ROUND_AVX2(12);
  DASP_ROUND_AVX2(13);
  DASP_ROUND_AVX2(14);
  DASP_ROUND_AVX2(15);
#undef DASP_ROUND_AVX2

  _mm256_storeu_si256((__m256i *)block, state);

  // Zenbleed Mitigation: Force SIMD YMM Register Wipe
  volatile __m256i wipe = _mm256_setzero_si256();
  state = wipe;
}

static inline uint32_t rotl32_scalar(uint32_t v, int c) {
    return (v << c) | (v >> (32 - c));
}

static inline void dasp_cascade_32_scalar(uint8_t *restrict block, const uint32_t *restrict round_keys) {
    uint32_t state[8];
    for(int i=0; i<8; i++) {
        state[i] = ((uint32_t)block[i*4]) | ((uint32_t)block[i*4+1] << 8) | 
                   ((uint32_t)block[i*4+2] << 16) | ((uint32_t)block[i*4+3] << 24);
    }
    
    for(int r=0; r<16; r++) {
        for(int i=0; i<8; i++) state[i] += round_keys[r*8 + i];
        uint32_t rc = 0x9E3779B9 + r;
        for(int i=0; i<8; i++) state[i] ^= rc;
        
        uint32_t swapped[8];
        if (r % 3 == 0) {
            swapped[0] = state[3]; swapped[1] = state[2]; swapped[2] = state[1]; swapped[3] = state[0];
            swapped[4] = state[7]; swapped[5] = state[6]; swapped[6] = state[5]; swapped[7] = state[4];
        } else if (r % 3 == 1) {
            swapped[0] = state[5]; swapped[1] = state[4]; swapped[2] = state[7]; swapped[3] = state[6];
            swapped[4] = state[1]; swapped[5] = state[0]; swapped[6] = state[3]; swapped[7] = state[2];
        } else {
            swapped[0] = state[6]; swapped[1] = state[7]; swapped[2] = state[4]; swapped[3] = state[5];
            swapped[4] = state[2]; swapped[5] = state[3]; swapped[6] = state[0]; swapped[7] = state[1];
        }
        
        uint32_t a_new[8], b_new[8];
        for(int i=0; i<8; i++) {
            a_new[i] = state[i] + swapped[i];
            b_new[i] = state[i] ^ a_new[i];
        }
        
        int rot = (r % 4 == 0) ? 16 : ((r % 4 == 1) ? 12 : ((r % 4 == 2) ? 8 : 7));
        for(int i=0; i<8; i++) b_new[i] = rotl32_scalar(b_new[i], rot);
        
        if (r % 3 == 0) {
            state[0] = a_new[0]; state[1] = a_new[1]; state[2] = a_new[2]; state[3] = a_new[3];
            state[4] = b_new[4]; state[5] = b_new[5]; state[6] = b_new[6]; state[7] = b_new[7];
        } else if (r % 3 == 1) {
            state[0] = a_new[0]; state[1] = a_new[1]; state[2] = b_new[2]; state[3] = b_new[3];
            state[4] = a_new[4]; state[5] = a_new[5]; state[6] = b_new[6]; state[7] = b_new[7];
        } else {
            state[0] = a_new[0]; state[1] = b_new[1]; state[2] = a_new[2]; state[3] = b_new[3];
            state[4] = a_new[4]; state[5] = b_new[5]; state[6] = a_new[6]; state[7] = b_new[7];
        }
    }
    
    for(int i=0; i<8; i++) {
        block[i*4] = state[i] & 0xFF;
        block[i*4+1] = (state[i] >> 8) & 0xFF;
        block[i*4+2] = (state[i] >> 16) & 0xFF;
        block[i*4+3] = (state[i] >> 24) & 0xFF;
    }
}

#if defined(__aarch64__) || defined(__ARM_NEON)
#include <arm_neon.h>
static inline void dasp_cascade_32_neon(uint8_t *restrict block, const uint32_t *restrict round_keys) {
    uint32x4_t state_lo = vld1q_u32((const uint32_t *)block);
    uint32x4_t state_hi = vld1q_u32((const uint32_t *)(block + 16));
    uint32x4_t mask_AA = vcombine_u32(vcreate_u32(0xFFFFFFFF00000000ULL), vcreate_u32(0xFFFFFFFF00000000ULL));

#define DASP_ROUND_NEON(r) \
    do { \
        uint32x4_t rk_lo = vld1q_u32(&round_keys[(r) * 8]); \
        uint32x4_t rk_hi = vld1q_u32(&round_keys[(r) * 8 + 4]); \
        state_lo = vaddq_u32(state_lo, rk_lo); \
        state_hi = vaddq_u32(state_hi, rk_hi); \
        uint32x4_t rc = vdupq_n_u32(0x9E3779B9 + (r)); \
        state_lo = veorq_u32(state_lo, rc); \
        state_hi = veorq_u32(state_hi, rc); \
        \
        uint32x4_t swapped_lo, swapped_hi; \
        if (((r) % 3) == 0) { \
            swapped_lo = state_hi; \
            swapped_hi = state_lo; \
        } else if (((r) % 3) == 1) { \
            swapped_lo = vextq_u32(state_lo, state_lo, 2); \
            swapped_hi = vextq_u32(state_hi, state_hi, 2); \
        } else { \
            swapped_lo = vrev64q_u32(state_lo); \
            swapped_hi = vrev64q_u32(state_hi); \
        } \
        \
        uint32x4_t a_new_lo = vaddq_u32(state_lo, swapped_lo); \
        uint32x4_t a_new_hi = vaddq_u32(state_hi, swapped_hi); \
        uint32x4_t b_new_lo = veorq_u32(state_lo, a_new_lo); \
        uint32x4_t b_new_hi = veorq_u32(state_hi, a_new_hi); \
        \
        uint32x4_t rotl_lo, rotl_hi, b_final_lo, b_final_hi; \
        if (((r) % 4) == 0) { \
            rotl_lo = vshlq_n_u32(b_new_lo, 16); \
            b_final_lo = vsriq_n_u32(rotl_lo, b_new_lo, 16); \
            rotl_hi = vshlq_n_u32(b_new_hi, 16); \
            b_final_hi = vsriq_n_u32(rotl_hi, b_new_hi, 16); \
        } else if (((r) % 4) == 1) { \
            rotl_lo = vshlq_n_u32(b_new_lo, 12); \
            b_final_lo = vsriq_n_u32(rotl_lo, b_new_lo, 20); \
            rotl_hi = vshlq_n_u32(b_new_hi, 12); \
            b_final_hi = vsriq_n_u32(rotl_hi, b_new_hi, 20); \
        } else if (((r) % 4) == 2) { \
            rotl_lo = vshlq_n_u32(b_new_lo, 8); \
            b_final_lo = vsriq_n_u32(rotl_lo, b_new_lo, 24); \
            rotl_hi = vshlq_n_u32(b_new_hi, 8); \
            b_final_hi = vsriq_n_u32(rotl_hi, b_new_hi, 24); \
        } else { \
            rotl_lo = vshlq_n_u32(b_new_lo, 7); \
            b_final_lo = vsriq_n_u32(rotl_lo, b_new_lo, 25); \
            rotl_hi = vshlq_n_u32(b_new_hi, 7); \
            b_final_hi = vsriq_n_u32(rotl_hi, b_new_hi, 25); \
        } \
        \
        if (((r) % 3) == 0) { \
            state_lo = a_new_lo; \
            state_hi = b_final_hi; \
        } else if (((r) % 3) == 1) { \
            state_lo = vcombine_u32(vget_low_u32(a_new_lo), vget_high_u32(b_final_lo)); \
            state_hi = vcombine_u32(vget_low_u32(a_new_hi), vget_high_u32(b_final_hi)); \
        } else { \
            state_lo = vbslq_u32(mask_AA, b_final_lo, a_new_lo); \
            state_hi = vbslq_u32(mask_AA, b_final_hi, a_new_hi); \
        } \
    } while(0)

    DASP_ROUND_NEON(0); DASP_ROUND_NEON(1); DASP_ROUND_NEON(2); DASP_ROUND_NEON(3);
    DASP_ROUND_NEON(4); DASP_ROUND_NEON(5); DASP_ROUND_NEON(6); DASP_ROUND_NEON(7);
    DASP_ROUND_NEON(8); DASP_ROUND_NEON(9); DASP_ROUND_NEON(10); DASP_ROUND_NEON(11);
    DASP_ROUND_NEON(12); DASP_ROUND_NEON(13); DASP_ROUND_NEON(14); DASP_ROUND_NEON(15);

#undef DASP_ROUND_NEON

    vst1q_u32((uint32_t *)block, state_lo);
    vst1q_u32((uint32_t *)(block + 16), state_hi);

    // Zenbleed Mitigation: Force SIMD Q Register Wipe
    volatile uint32x4_t wipe = vdupq_n_u32(0);
    state_lo = wipe;
    state_hi = wipe;
}
#endif

static int check_avx2_support() {
#ifdef _MSC_VER
    int cpuInfo[4];
    __cpuid(cpuInfo, 1);
    if ((cpuInfo[2] & (1 << 27)) == 0) return 0; // OSXSAVE
    if ((_xgetbv(_XCR_XFEATURE_ENABLED_MASK) & 6) != 6) return 0;
    __cpuidex(cpuInfo, 7, 0);
    return (cpuInfo[1] & (1 << 5)) != 0;
#else
    return __builtin_cpu_supports("avx2");
#endif
}

static int g_avx2_supported = -1;

static inline void dasp_cascade_32(uint8_t *restrict block, const uint32_t *restrict round_keys) {
#if defined(__aarch64__) || defined(__ARM_NEON)
    dasp_cascade_32_neon(block, round_keys);
#else
    if (g_avx2_supported == -1) g_avx2_supported = check_avx2_support();
    if (g_avx2_supported) {
        dasp_cascade_32_avx2(block, round_keys);
    } else {
        dasp_cascade_32_scalar(block, round_keys);
    }
#endif
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

  uint8_t chain_state[32];
  {
    char buf[256];
    sprintf(buf, "dasp-chain-%s", active_password_str);
    crypto_sha256((uint8_t *)buf, strlen(buf), chain_state);
  }

  uint8_t word_key[32];
  crypto_hmac_sha256((uint8_t *)active_password_str, 64,
                     (uint8_t *)"dasp-word-0", 11, word_key);

  char word_key_hex[65];
  for (int i = 0; i < 32; i++)
    sprintf(&word_key_hex[i * 2], "%02x", word_key[i]);

  prng_t rng;
  prng_init(&rng, word_key_hex);

  alignas(32) uint32_t round_keys[128];
  for (int i = 0; i < 128; i++) {
    round_keys[i] = prng_next(&rng);
  }

  alignas(32) uint8_t nonce[32];
  memcpy(nonce, chain_state, 32);

  // --- DPA Signature ---
  uint8_t sig_buf[64] = {0};
  memcpy(sig_buf, blended_ss, 32);
  size_t p_prefix = payload_len > 32 ? 32 : payload_len;
  memcpy(sig_buf + 32, base_payload, p_prefix);
  uint64_t sig = fnv1a_64(sig_buf, 32 + p_prefix);
  int dpa_triggered = check_dpa_pattern(sig);

  // ---------------------------------------------------------
  // PHASE 4: Block Encryption (D-ASP Cascade 16)
  // ---------------------------------------------------------
  for (size_t i = 0; i < payload_len; i += 32) {
    alignas(32) uint8_t block[32];
    memcpy(block, nonce, 32);
    dasp_cascade_32(block, round_keys);

    size_t chunk = (payload_len - i < 32) ? (payload_len - i) : 32;
    for (size_t j = 0; j < chunk; j++) {
      base_payload[i + j] ^= block[j];
    }

    for (int j = 0; j < 32; j++) {
      if (++nonce[j])
        break;
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
  if (mac_diff != 0 || mac_diff_fi != 0)
    return -1;

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
  uint8_t chain_state[32];
  {
    char buf[256];
    sprintf(buf, "dasp-chain-%s", active_password_str);
    crypto_sha256((uint8_t *)buf, strlen(buf), chain_state);
  }

  prng_t rng;
  prng_init(&rng, word_key_hex);

  alignas(32) uint32_t round_keys[128];
  for (int i = 0; i < 128; i++) {
    round_keys[i] = prng_next(&rng);
  }

  alignas(32) uint8_t nonce[32];
  memcpy(nonce, chain_state, 32);

  // --- DPA Signature ---
  uint8_t sig_buf[64] = {0};
  memcpy(sig_buf, blended_ss, 32);
  size_t p_prefix = payload_len > 32 ? 32 : payload_len;
  memcpy(sig_buf + 32, base_payload, p_prefix); // using ciphertext bytes
  uint64_t sig = fnv1a_64(sig_buf, 32 + p_prefix);
  int dpa_triggered = check_dpa_pattern(sig);

  for (size_t i = 0; i < payload_len; i += 32) {
    alignas(32) uint8_t block[32];
    memcpy(block, nonce, 32);
    dasp_cascade_32(block, round_keys);

    size_t chunk = (payload_len - i < 32) ? (payload_len - i) : 32;
    for (size_t j = 0; j < chunk; j++) {
      base_payload[i + j] ^= block[j];
    }

    for (int j = 0; j < 32; j++) {
      if (++nonce[j])
        break;
    }
  }

  if (dpa_triggered) {
    for (size_t k = 0; k < payload_len; k++) {
      base_payload[k] ^= (uint8_t)prng_next(&rng);
    }
    dasp_secure_wipe(blended_ss, 32);
    dasp_secure_wipe(cipher_key, 32);
    dasp_secure_wipe(hmac_key, 32);
    dasp_secure_wipe(chain_state, 32);
    dasp_secure_wipe(word_key, 32);
    dasp_secure_wipe(active_password_str, 65);
    dasp_secure_wipe(word_key_hex, 65);
    dasp_secure_wipe(round_keys, sizeof(round_keys));
    return -2;
  }

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
