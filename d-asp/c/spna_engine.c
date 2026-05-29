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
  ctx->state[0] = 0x61707865;
  ctx->state[1] = 0x3320646e;
  ctx->state[2] = 0x79622d32;
  ctx->state[3] = 0x6b206574;
  for (int i = 0; i < 8; i++) {
    ctx->state[4 + i] = hash[i * 4] | (hash[i * 4 + 1] << 8) |
                        (hash[i * 4 + 2] << 16) | (hash[i * 4 + 3] << 24);
  }
  ctx->state[12] = 0;
  ctx->state[13] = 0;
  ctx->state[14] = 0;
  ctx->state[15] = 0;
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
    static inline void dasp_cascade_32(uint8_t *restrict block,
                                       const uint32_t *restrict round_keys) {
  __m256i *aligned_block = (__m256i *)__builtin_assume_aligned(block, 32);
  const __m256i *aligned_keys =
      (const __m256i *)__builtin_assume_aligned(round_keys, 32);

  __m256i state = _mm256_load_si256(aligned_block);

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

  _mm256_store_si256(aligned_block, state);
}

int dasp_encapsulate_data_inner(uint8_t *base_payload, size_t payload_len,
                                const uint8_t *pk, const uint8_t *hwid,
                                uint8_t *out_ct, uint8_t *out_mac) {
  uint8_t ss[32];
  crypto_kem_enc(out_ct, ss, pk);

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

  uint8_t *mac_content = malloc(CRYPTO_CIPHERTEXTBYTES + payload_len);
  memcpy(mac_content, out_ct, CRYPTO_CIPHERTEXTBYTES);
  memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES, base_payload, payload_len);
  crypto_hmac_sha256(hmac_key, 32, mac_content,
                     CRYPTO_CIPHERTEXTBYTES + payload_len, out_mac);
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
                                const uint8_t *in_ct, const uint8_t *in_mac) {
  uint8_t ss[32];
  crypto_kem_dec(ss, in_ct, sk);

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

  char blended_hex[65], mac_in_hex[65], mac_actual_hex[65];
  for (int i = 0; i < 32; i++)
    sprintf(&blended_hex[i * 2], "%02x", blended_ss[i]);
  for (int i = 0; i < 32; i++)
    sprintf(&mac_in_hex[i * 2], "%02x", in_mac[i]);

  char word_key_hex[65];
  for (int i = 0; i < 32; i++)
    sprintf(&word_key_hex[i * 2], "%02x", word_key[i]);

  uint8_t *mac_content = malloc(CRYPTO_CIPHERTEXTBYTES + payload_len);
  memcpy(mac_content, in_ct, CRYPTO_CIPHERTEXTBYTES);
  memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES, base_payload, payload_len);
  uint8_t actual_mac[32];
  crypto_hmac_sha256(hmac_key, 32, mac_content,
                     CRYPTO_CIPHERTEXTBYTES + payload_len, actual_mac);
  free(mac_content);

  for (int i = 0; i < 32; i++)
    sprintf(&mac_actual_hex[i * 2], "%02x", actual_mac[i]);

  fprintf(stderr,
          "{\"diagnostics\":{\"stage1_blended_ss\":\"%s\",\"stage2_word_key\":"
          "\"%s\",\"stage4_mac_in\":\"%s\",\"stage4_mac_actual\":\"%s\"}}\n",
          blended_hex, word_key_hex, mac_in_hex, mac_actual_hex);
  fflush(stderr);

  uint8_t mac_diff = 0;
  for (int i = 0; i < 32; i++) {
    mac_diff |= (in_mac[i] ^ actual_mac[i]);
  }
  if (mac_diff != 0)
    return -1;

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
