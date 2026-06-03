/**
 * @file rng.c
 * @brief Deterministic Random Bit Generator (DRBG) implementation.
 *
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 */

#include "rng.h"
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#pragma comment(lib, "bcrypt.lib")
#else
#include <fcntl.h>
#include <unistd.h>
#endif

/** @brief DRBG Internal State using ChaCha */
typedef struct {
  uint32_t state[16]; /**< ChaCha base state */
  uint32_t block[16]; /**< Generated random keystream block */
  size_t block_idx;   /**< Current index into the generated block */
  int reseed_counter;
} DRBG_CTX;

static DRBG_CTX drbg_ctx;

static inline uint32_t rng_rotl32(uint32_t x, int n) {
  return (x << n) | (x >> (32 - n));
}

static void rng_chacha_quarter_round(uint32_t *x, int a, int b, int c, int d) {
  x[a] = x[a] + x[b]; x[d] ^= x[a]; x[d] = rng_rotl32(x[d], 16);
  x[c] = x[c] + x[d]; x[b] ^= x[c]; x[b] = rng_rotl32(x[b], 12);
  x[a] = x[a] + x[b]; x[d] ^= x[a]; x[d] = rng_rotl32(x[d], 8);
  x[c] = x[c] + x[d]; x[b] ^= x[c]; x[b] = rng_rotl32(x[b], 7);
}

static void rng_chacha_block(uint32_t *state, uint32_t *out) {
  uint32_t x[16];
  for (int i = 0; i < 16; i++) x[i] = state[i];
  for (int i = 0; i < 10; i++) {
    rng_chacha_quarter_round(x, 0, 4, 8, 12);
    rng_chacha_quarter_round(x, 1, 5, 9, 13);
    rng_chacha_quarter_round(x, 2, 6, 10, 14);
    rng_chacha_quarter_round(x, 3, 7, 11, 15);
    rng_chacha_quarter_round(x, 0, 5, 10, 15);
    rng_chacha_quarter_round(x, 1, 6, 11, 12);
    rng_chacha_quarter_round(x, 2, 7, 8, 13);
    rng_chacha_quarter_round(x, 3, 4, 9, 14);
  }
  for (int i = 0; i < 16; i++) out[i] = x[i] + state[i];
}

/**
 * @brief Initializes the DRBG with entropy and personalization string.
 * @param entropy_input 48 bytes of initial entropy.
 * @param personalization_string Optional personalization string.
 * @param security_strength Ignored.
 */
void randombytes_init(unsigned char *entropy_input,
                      unsigned char *personalization_string,
                      int security_strength) {
  (void)security_strength;
  unsigned char seed_material[48];
  memcpy(seed_material, entropy_input, 48);
  if (personalization_string) {
    for (int i = 0; i < 48; i++) {
      seed_material[i] ^= personalization_string[i];
    }
  }

  drbg_ctx.state[0] = 0x61707865;
  drbg_ctx.state[1] = 0x3320646e;
  drbg_ctx.state[2] = 0x79622d32;
  drbg_ctx.state[3] = 0x6b206574;
  
  // Use first 32 bytes for the key
  for (int i = 0; i < 8; i++) {
    drbg_ctx.state[4 + i] = seed_material[i * 4] | (seed_material[i * 4 + 1] << 8) |
                            (seed_material[i * 4 + 2] << 16) | (seed_material[i * 4 + 3] << 24);
  }
  
  // Use last 16 bytes for nonce/counter
  for (int i = 0; i < 4; i++) {
    drbg_ctx.state[12 + i] = seed_material[32 + i * 4] | (seed_material[32 + i * 4 + 1] << 8) |
                             (seed_material[32 + i * 4 + 2] << 16) | (seed_material[32 + i * 4 + 3] << 24);
  }

  rng_chacha_block(drbg_ctx.state, drbg_ctx.block);
  drbg_ctx.block_idx = 0;
  drbg_ctx.reseed_counter = 1;
}

/**
 * @brief Generates cryptographically secure random bytes.
 * @param x Output buffer.
 * @param xlen Number of bytes to generate.
 * @return RNG_SUCCESS (0).
 */
int randombytes(unsigned char *x, unsigned long long xlen) {
  if (drbg_ctx.reseed_counter == 0) {
    unsigned char auto_seed[48];
#ifdef _WIN32
    if (BCryptGenRandom(NULL, auto_seed, 48, BCRYPT_USE_SYSTEM_PREFERRED_RNG) != 0) {
      fprintf(stderr, "Fatal: BCryptGenRandom failed in auto-seed\n");
      exit(1);
    }
#else
    int fd = open("/dev/urandom", O_RDONLY);
    if (fd != -1) {
      if (read(fd, auto_seed, 48) != 48) {
        fprintf(stderr, "Fatal: Failed to read sufficient entropy from /dev/urandom in auto-seed\n");
        exit(1);
      }
      close(fd);
    } else {
      fprintf(stderr, "Fatal: Could not open /dev/urandom in auto-seed\n");
      exit(1);
    }
#endif
    randombytes_init(auto_seed, NULL, 256);
  }

  unsigned char *out = (unsigned char *)drbg_ctx.block;
  while (xlen > 0) {
    if (drbg_ctx.block_idx >= 64) {
      drbg_ctx.state[12]++;
      if (drbg_ctx.state[12] == 0) drbg_ctx.state[13]++;
      rng_chacha_block(drbg_ctx.state, drbg_ctx.block);
      drbg_ctx.block_idx = 0;
    }
    
    size_t avail = 64 - drbg_ctx.block_idx;
    size_t to_copy = (xlen < avail) ? xlen : avail;
    memcpy(x, out + drbg_ctx.block_idx, to_copy);
    drbg_ctx.block_idx += to_copy;
    x += to_copy;
    xlen -= to_copy;
  }
  
  drbg_ctx.reseed_counter++;
  return RNG_SUCCESS;
}
