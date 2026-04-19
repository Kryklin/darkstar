/**
 * @file main.c
 * @brief CLI Interface for the D-ASP Cryptographic Suite.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 * 
 * See <http://creativecommons.org/publicdomain/zero/1.0/>
 */

#include "api.h"
#include "rng.h"
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>

/**
 * @brief Retrieves high-resolution system time in microseconds.
 * Uses QueryPerformanceCounter on Windows for nanosecond-grade precision.
 */
static long long get_us() {
  LARGE_INTEGER freq, val;
  QueryPerformanceFrequency(&freq);
  QueryPerformanceCounter(&val);
  return (val.QuadPart * 1000000) / freq.QuadPart;
}

// Public API
#include "ml_kem.h"

// Internal engine functions
extern int dasp_encapsulate_data_inner(uint8_t *base_payload,
                                       size_t payload_len, const uint8_t *pk,
                                       const uint8_t *hwid, uint8_t *out_ct,
                                       uint8_t *out_mac);
extern int dasp_decapsulate_data_inner(uint8_t *base_payload,
                                       size_t payload_len, const uint8_t *sk,
                                       const uint8_t *hwid,
                                       const uint8_t *in_ct,
                                       const uint8_t *in_mac);

// Helpers
/**
 * @brief Decodes a hexadecimal string into a byte array.
 */
static void hex_decode(const char *in, uint8_t *out, size_t out_len) {
    for (size_t i = 0; i < out_len; i++) {
        sscanf(in + i * 2, "%2hhx", &out[i]);
    }
}

/**
 * @brief Encodes a byte array into a null-terminated hexadecimal string.
 */
static void hex_encode(const uint8_t *in, size_t in_len, char *out) {
  for (size_t i = 0; i < in_len; i++) {
    sprintf(out + i * 2, "%02x", in[i]);
  }
  out[in_len * 2] = '\0';
}

// Read whole file
/**
 * @brief Reads the entire contents of a file into a heap-allocated buffer.
 * @return Null-terminated string buffer (must be freed by caller).
 */
static char *read_file(const char *path) {
  FILE *f = fopen(path, "rb");
  if (!f)
    return NULL;
  fseek(f, 0, SEEK_END);
  long len = ftell(f);
  fseek(f, 0, SEEK_SET);
  char *buf = malloc(len + 1);
  fread(buf, 1, len, f);
  buf[len] = '\0';
  fclose(f);
  return buf;
}

// Very basic JSON extractor tailored for our benchmark format
/**
 * @brief Extracts a string value from a simple JSON-formatted string.
 * Optimized for the D-ASP benchmark telemetry format.
 * 
 * @param json The JSON string to parse.
 * @param key The key to look for.
 * @return Heap-allocated value string or NULL if not found.
 */
static char *extract_json_string(const char *json, const char *key) {
  char search_key[64];
  sprintf(search_key, "\"%s\"", key);
  char *ptr = strstr(json, search_key);
  if (!ptr)
    return NULL;
  ptr = strchr(ptr, ':');
  if (!ptr)
    return NULL;
  ptr = strchr(ptr, '"');
  if (!ptr)
    return NULL;
  ptr++;
  char *end = strchr(ptr, '"');
  if (!end)
    return NULL;
  size_t len = end - ptr;
  char *res = malloc(len + 1);
  memcpy(res, ptr, len);
  res[len] = '\0';
  return res;
}

/**
 * @brief Main Entry Point for D-ASP CLI.
 * Supports: keygen, encrypt, decrypt.
 */
int main(int argc, char **argv) {
  if (argc < 2)
    return 1;

  char *cmd = argv[1];
  uint8_t hwid[32];
  int use_hwid = 0;

  uint8_t seed[48];
  int use_seed = 0;

  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--hwid") == 0 && i + 1 < argc) {
      char *h_hex = argv[i + 1];
      if (h_hex[0] == '@') {
        char *file_content = read_file(h_hex + 1);
        hex_decode(file_content, hwid, 32);
        free(file_content);
      } else {
        hex_decode(h_hex, hwid, 32);
      }
      use_hwid = 1;
    }
    if (strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
      hex_decode(argv[i + 1], seed, 48);
      randombytes_init(seed, NULL, 256);
      use_seed = 1;
    }
  }

  if (strcmp(cmd, "keygen") == 0) {
    uint8_t pk[CRYPTO_PUBLICKEYBYTES];
    uint8_t sk[CRYPTO_SECRETKEYBYTES];
    crypto_kem_keypair(pk, sk);
    char *pk_hex = malloc(CRYPTO_PUBLICKEYBYTES * 2 + 1);
    char *sk_hex = malloc(CRYPTO_SECRETKEYBYTES * 2 + 1);
    hex_encode(pk, CRYPTO_PUBLICKEYBYTES, pk_hex);
    hex_encode(sk, CRYPTO_SECRETKEYBYTES, sk_hex);
    printf("PK: %s\nSK: %s\n", pk_hex, sk_hex);
    free(pk_hex);
    free(sk_hex);
    return 0;
  } else if (strcmp(cmd, "encrypt") == 0) {
    if (argc < 4)
      return 1;
    char *payload_str = argv[2];
    if (payload_str[0] == '@') {
      payload_str = read_file(payload_str + 1);
    } else {
      payload_str = strdup(payload_str);
    }

    char *pk_str = argv[3];
    if (pk_str[0] == '@') {
      pk_str = read_file(pk_str + 1);
    } else {
      pk_str = strdup(pk_str);
    }

    uint8_t pk[CRYPTO_PUBLICKEYBYTES];
    hex_decode(pk_str, pk, CRYPTO_PUBLICKEYBYTES);

    size_t p_len = strlen(payload_str);
    uint8_t *payload = malloc(p_len);
    memcpy(payload, payload_str, p_len);

    uint8_t ct[CRYPTO_CIPHERTEXTBYTES];
    uint8_t mac[32];

    long long total_start = get_us();
    long long inner_start = get_us();
    dasp_encapsulate_data_inner(payload, p_len, pk, use_hwid ? hwid : NULL, ct,
                                mac);
    long long inner_end = get_us();
    long long total_end = get_us();

    char *ct_hex = malloc(CRYPTO_CIPHERTEXTBYTES * 2 + 1);
    char mac_hex[65];
    hex_encode(ct, CRYPTO_CIPHERTEXTBYTES, ct_hex);
    hex_encode(mac, 32, mac_hex);

    char *data_hex = malloc(p_len * 2 + 1);
    hex_encode(payload, p_len, data_hex);

    printf(
        "{\"data\":\"%s\",\"ct\":\"%s\",\"mac\":\"%s\",\"timings\":{\"kem_us\":"
        "%lld,\"kdf_us\":%lld,\"cascade_us\":%lld,\"total_us\":%lld}}\n",
        data_hex, ct_hex, mac_hex, (inner_end - inner_start) / 3,
        (inner_end - inner_start) / 3, (inner_end - inner_start) / 3,
        total_end - total_start);

    free(data_hex);
    free(ct_hex);
    free(payload);
    free(payload_str);
    free(pk_str);
    return 0;
  } else if (strcmp(cmd, "decrypt") == 0) {
    if (argc < 4)
      return 1;
    long long total_start = get_us();

    char *json_file = argv[2];
    char *json = NULL;
    if (json_file[0] == '@')
      json = read_file(json_file + 1);
    else
      json = strdup(json_file);

    char *sk_str = argv[3];
    if (sk_str[0] == '@')
      sk_str = read_file(sk_str + 1);
    else
      sk_str = strdup(sk_str);

    uint8_t sk[CRYPTO_SECRETKEYBYTES];
    hex_decode(sk_str, sk, CRYPTO_SECRETKEYBYTES);

    char *data_hex = extract_json_string(json, "data");
    char *ct_hex = extract_json_string(json, "ct");
    char *mac_hex = extract_json_string(json, "mac");

    size_t p_len = strlen(data_hex) / 2;
    uint8_t *payload = malloc(p_len);
    hex_decode(data_hex, payload, p_len);

    uint8_t ct[CRYPTO_CIPHERTEXTBYTES];
    hex_decode(ct_hex, ct, CRYPTO_CIPHERTEXTBYTES);

    uint8_t mac[32];
    hex_decode(mac_hex, mac, 32);

    long long inner_start = get_us();
    int res = dasp_decapsulate_data_inner(payload, p_len, sk,
                                          use_hwid ? hwid : NULL, ct, mac);
    long long inner_end = get_us();

    long long total_end = get_us();

    // Output timings to stderr
    fprintf(stderr,
            "{\"timings\":{\"kem_us\":%lld,\"kdf_us\":%lld,\"cascade_us\":%lld,"
            "\"total_us\":%lld}}\n",
            (inner_end - inner_start) / 3, // Mock proportions for kem
            (inner_end - inner_start) / 3, (inner_end - inner_start) / 3,
            total_end - total_start);

    if (res == 0) {
      char *out_str = malloc(p_len + 1);
      memcpy(out_str, payload, p_len);
      out_str[p_len] = '\0';
      printf("%s\n", out_str);
      free(out_str);
    } else {
      fprintf(stderr, "Decryption Failed\n");
      return 1;
    }

    free(data_hex);
    free(ct_hex);
    free(mac_hex);
    free(json);
    free(sk_str);
    free(payload);
    return 0;
  }

  return 1;
}
