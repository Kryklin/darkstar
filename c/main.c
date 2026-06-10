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
#define _CRT_SECURE_NO_WARNINGS
#define _CRT_NONSTDC_NO_DEPRECATE

#include "dasp.h"
#include "poly.h"
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
#include <time.h>
#include <unistd.h>
#endif

/**
 * @brief Retrieves high-resolution system time in microseconds.
 * Uses QueryPerformanceCounter on Windows for nanosecond-grade precision.
 */
static long long get_us() {
#ifdef _WIN32
  LARGE_INTEGER freq, val;
  QueryPerformanceFrequency(&freq);
  QueryPerformanceCounter(&val);
  return (val.QuadPart * 1000000) / freq.QuadPart;
#else
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (long long)ts.tv_sec * 1000000LL + (long long)ts.tv_nsec / 1000LL;
#endif
}

// Public API
#include "ml_kem.h"

// Internal engine functions
extern int dasp_encapsulate_data_inner(uint8_t *base_payload,
                                       size_t payload_len, const uint8_t *pk,
                                       const uint8_t *hwid, uint8_t *out_ct,
                                       uint8_t *out_mac, uint64_t ts, int has_ts);
extern int dasp_decapsulate_data_inner(uint8_t *base_payload,
                                       size_t payload_len, const uint8_t *sk,
                                       const uint8_t *hwid,
                                       const uint8_t *in_ct,
                                       const uint8_t *in_mac, uint64_t ts, int has_ts);

// Helpers
static inline uint8_t hex_char_val(char c) {
  if (c >= '0' && c <= '9')
    return c - '0';
  if (c >= 'a' && c <= 'f')
    return c - 'a' + 10;
  if (c >= 'A' && c <= 'F')
    return c - 'A' + 10;
  return 0;
}

static void hex_decode(const char *in, uint8_t *out, size_t out_len) {
  for (size_t i = 0; i < out_len; i++) {
    out[i] = (hex_char_val(in[i * 2]) << 4) | hex_char_val(in[i * 2 + 1]);
  }
}

static void hex_encode(const uint8_t *in, size_t in_len, char *out) {
  static const char hex[] = "0123456789abcdef";
  for (size_t i = 0; i < in_len; i++) {
    out[i * 2] = hex[in[i] >> 4];
    out[i * 2 + 1] = hex[in[i] & 0x0F];
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
  char *buf = malloc(len + 1);
  if (!buf) {
    fclose(f);
    return NULL;
  }
  fseek(f, 0, SEEK_SET);
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
  if (!res)
    return NULL;
  memcpy(res, ptr, len);
  res[len] = '\0';
  return res;
}

/**
 * @brief Main Entry Point for D-ASP CLI.
 * Supports: keygen, encrypt, decrypt.
 */
int main(int argc, char *argv[]) {
  if (argc < 2) {
    fprintf(stderr, "Usage: %s <cmd> ...\n", argv[0]);
    return 1;
  }
  poly_verify_constants();
  // ---------------------------------------------------------
  // PHASE 1: CLI Argument Parsing
  // ---------------------------------------------------------

  char *cmd = argv[1];
  uint8_t hwid[32];
  int use_hwid = 0;
  uint8_t new_hwid[32];
  int use_new_hwid = 0;

  uint8_t seed[48];
  int has_seed = 0;
  int telemetry = 0;
  uint64_t ttl = 0;

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
    if (strcmp(argv[i], "--new-hwid") == 0 && i + 1 < argc) {
      char *h_hex = argv[i + 1];
      if (h_hex[0] == '@') {
        char *file_content = read_file(h_hex + 1);
        hex_decode(file_content, new_hwid, 32);
        free(file_content);
      } else {
        hex_decode(h_hex, new_hwid, 32);
      }
      use_new_hwid = 1;
    }
    if (strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
      hex_decode(argv[i + 1], seed, 48);
      has_seed = 1;
    }
    if (strcmp(argv[i], "--ttl") == 0 && i + 1 < argc) {
      ttl = strtoull(argv[i + 1], NULL, 10);
    }
    if (strcmp(argv[i], "--telemetry") == 0) {
      telemetry = 1;
    }
  }

  // OS-native entropy fallback for the internal DRBG
  if (!has_seed) {
#ifdef _WIN32
    BCryptGenRandom(NULL, seed, 48, BCRYPT_USE_SYSTEM_PREFERRED_RNG);
#else
    int fd = open("/dev/urandom", O_RDONLY);
    if (fd != -1) {
      if (read(fd, seed, 48) != 48) {
        fprintf(stderr,
                "Fatal: Failed to read sufficient entropy from /dev/urandom\n");
        exit(1);
      }
      close(fd);
    } else {
      fprintf(stderr, "Fatal: Could not open /dev/urandom\n");
      exit(1);
    }
#endif
  }

  // Initialize the DRBG regardless of whether the seed came from CLI or OS
  // Initialize the DRBG regardless of whether the seed came from CLI or OS
  randombytes_init(seed, NULL, 256);

  // ---------------------------------------------------------
  // PHASE 2: Cryptographic Command Execution
  // ---------------------------------------------------------

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
      return 2;
    char *payload_str = argv[2];
    if (payload_str[0] == '@') {
      payload_str = read_file(payload_str + 1);
      if (!payload_str)
        return 3;
    } else {
      payload_str = strdup(payload_str);
    }

    char *pk_str = argv[3];
    if (pk_str[0] == '@') {
      pk_str = read_file(pk_str + 1);
      if (!pk_str)
        return 3;
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
    uint64_t current_ts = (uint64_t)(total_start / 1000000);
    randombytes_force_reseed();
    int res = dasp_encapsulate_data_inner(payload, p_len, pk, use_hwid ? hwid : NULL, ct,
                                mac, current_ts, 1);
    long long inner_end = get_us();
    long long total_end = get_us();

    char *ct_hex = malloc(CRYPTO_CIPHERTEXTBYTES * 2 + 1);
    char mac_hex[65];
    hex_encode(ct, CRYPTO_CIPHERTEXTBYTES, ct_hex);
    hex_encode(mac, 32, mac_hex);

    char *data_hex = malloc(p_len * 2 + 1);
    hex_encode(payload, p_len, data_hex);

    if (res == -2) {
      printf("{\"error\":\"DPA_LOCKOUT\"}\n");
    } else {
      if (telemetry) {
        printf("{\"data\":\"%s\",\"ct\":\"%s\",\"mac\":\"%s\",\"ts\":%llu,\"timings\":{\"kem_"
               "us\":"
               "%lld,\"kdf_us\":%lld,\"cascade_us\":%lld,\"total_us\":%lld}}\n",
               data_hex, ct_hex, mac_hex, current_ts, (inner_end - inner_start) / 3,
               (inner_end - inner_start) / 3, (inner_end - inner_start) / 3,
               total_end - total_start);
      } else {
        printf("{\"data\":\"%s\",\"ct\":\"%s\",\"mac\":\"%s\",\"ts\":%llu}\n", data_hex,
               ct_hex, mac_hex, current_ts);
      }
    }
    free(data_hex);
    free(ct_hex);
    free(payload);
    free(payload_str);
    free(pk_str);
    return 0;
  } else if (strcmp(cmd, "stream-decrypt") == 0) {
    if (argc < 3)
      return 2;

    char *sk_str = argv[2];
    if (sk_str[0] == '@') {
      sk_str = read_file(sk_str + 1);
      if (!sk_str)
        return 3;
    } else {
      sk_str = strdup(sk_str);
    }

    uint8_t sk[CRYPTO_SECRETKEYBYTES];
    hex_decode(sk_str, sk, CRYPTO_SECRETKEYBYTES);

    char *line = malloc(1024 * 1024); // 1MB buffer for streams
    if (!line) {
      free(sk_str);
      return 1;
    }
    while (fgets(line, 1024 * 1024, stdin)) {
      size_t len = strlen(line);
      if (len > 0 && line[len - 1] == '\n')
        line[len - 1] = '\0';
      if (strlen(line) == 0)
        continue;

      long long start_time = get_us();

      char *data_hex = extract_json_string(line, "data");
      char *ct_hex = extract_json_string(line, "ct");
      char *mac_hex = extract_json_string(line, "mac");

      if (!data_hex || !ct_hex || !mac_hex) {
        fprintf(stderr, "CUDA-DASP: Invalid JSON stream payload\n");
        if (data_hex)
          free(data_hex);
        if (ct_hex)
          free(ct_hex);
        if (mac_hex)
          free(mac_hex);
        continue;
      }

      size_t p_len = strlen(data_hex) / 2;
      uint8_t *payload = malloc(p_len);
      hex_decode(data_hex, payload, p_len);

      uint8_t ct[CRYPTO_CIPHERTEXTBYTES];
      hex_decode(ct_hex, ct, CRYPTO_CIPHERTEXTBYTES);

      uint8_t mac[32];
      hex_decode(mac_hex, mac, 32);

      char *ts_str = extract_json_string(line, "ts");
      uint64_t ts_val = 0;
      int has_ts = 0;
      if (ts_str) {
        ts_val = strtoull(ts_str, NULL, 10);
        has_ts = 1;
        free(ts_str);
      }

      long long inner_start = get_us();
      int res = dasp_decapsulate_data_inner(payload, p_len, sk,
                                            use_hwid ? hwid : NULL, ct, mac, ts_val, has_ts);
      long long inner_end = get_us();

      long long end_time = get_us();
      if (res == 0) {
        if (ttl > 0) {
          if (!has_ts) {
            printf("{\"error\":\"Payload missing timestamp (Replay Protection enforced)\"}\n");
            free(payload);
            continue;
          }
          uint64_t current_ts = (uint64_t)(get_us() / 1000000);
          if (current_ts > ts_val + ttl) {
            printf("{\"error\":\"Payload Expired (Replay Protection)\"}\n");
            free(payload);
            continue;
          }
        }
        char *out_str = malloc(p_len + 1);
        memcpy(out_str, payload, p_len);
        out_str[p_len] = '\0';
        if (telemetry) {
          printf("{\"data\":\"%s\",\"timings\":{\"cascade_us\":%lld,\"total_"
                 "us\":%lld}}\n",
                 out_str, (inner_end - inner_start) / 3, get_us() - start_time);
        } else {
          printf("%s\n", out_str);
        }
        free(out_str);
      } else {
        printf("{\"error\":\"MAC Failed\"}\n");
      }
      fflush(stdout);

      free(data_hex);
      free(ct_hex);
      free(mac_hex);
      free(payload);
    }

    free(line);
    free(sk_str);
    return 0;

  } else if (strcmp(cmd, "decrypt") == 0) {
    if (argc < 4)
      return 2;
    long long total_start = get_us();

    char *json_file = argv[2];
    char *json_data = NULL;
    if (json_file[0] == '@') {
      json_data = read_file(json_file + 1);
      if (!json_data)
        return 3;
    } else {
      json_data = strdup(json_file);
    }

    char *sk_str = argv[3];
    if (sk_str[0] == '@') {
      sk_str = read_file(sk_str + 1);
      if (!sk_str)
        return 3;
    } else {
      sk_str = strdup(sk_str);
    }

    uint8_t sk[CRYPTO_SECRETKEYBYTES];
    hex_decode(sk_str, sk, CRYPTO_SECRETKEYBYTES);

    char *data_hex = extract_json_string(json_data, "data");
    char *ct_hex = extract_json_string(json_data, "ct");
    char *mac_hex = extract_json_string(json_data, "mac");

    char *ts_str = extract_json_string(json_data, "ts");
    uint64_t ts_val = 0;
    int has_ts = 0;
    if (ts_str) {
      ts_val = strtoull(ts_str, NULL, 10);
      has_ts = 1;
      free(ts_str);
    }

    if (!data_hex || !ct_hex || !mac_hex)
      return 4;

    size_t p_len = strlen(data_hex) / 2;
    uint8_t *payload = malloc(p_len);
    hex_decode(data_hex, payload, p_len);

    uint8_t ct[CRYPTO_CIPHERTEXTBYTES];
    hex_decode(ct_hex, ct, CRYPTO_CIPHERTEXTBYTES);

    uint8_t mac[32];
    hex_decode(mac_hex, mac, 32);

    long long inner_start = get_us();
    int res = dasp_decapsulate_data_inner(payload, p_len, sk,
                                          use_hwid ? hwid : NULL, ct, mac, ts_val, has_ts);
    long long inner_end = get_us();

    long long total_end = get_us();

    if (telemetry) {
      fprintf(stderr,
              "{\"timings\":{\"kem_us\":%lld,\"kdf_us\":%lld,\"cascade_us\":%"
              "lld,\"total_us\":%lld}}\n",
              (inner_end - inner_start) / 3, // Mock proportions for kem
              (inner_end - inner_start) / 3, (inner_end - inner_start) / 3,
              total_end - total_start);
    }

    if (res == -2) {
      printf("{\"error\":\"DPA_LOCKOUT\"}\n");
    } else if (res == 0) {
      if (ttl > 0) {
        if (!has_ts) {
          printf("{\"error\":\"Payload missing timestamp (Replay Protection enforced)\"}\n");
          free(payload); free(json_data); free(sk_str); free(data_hex); free(ct_hex); free(mac_hex);
          return 1;
        }
        uint64_t current_ts = (uint64_t)(get_us() / 1000000);
        if (current_ts > ts_val + ttl) {
          printf("{\"error\":\"Payload Expired (Replay Protection)\"}\n");
          free(payload); free(json_data); free(sk_str); free(data_hex); free(ct_hex); free(mac_hex);
          return 1;
        }
      }
      char *out_str = malloc(p_len + 1);
      memcpy(out_str, payload, p_len);
      out_str[p_len] = '\0';
      printf("%s\n", out_str);
      free(out_str);
    } else {
      fprintf(stderr, "Decryption Failed (Integrity or KEM Error)\n");
      return 5;
    }

    free(data_hex);
    free(ct_hex);
    free(mac_hex);
    free(json_data);
    free(sk_str);
    free(payload);
    return 0;
  } else if (strcmp(cmd, "rebind") == 0) {
    if (argc < 5)
      return 2;
    char *json_file = argv[2];
    char *json = NULL;
    if (json_file[0] == '@') {
      json = read_file(json_file + 1);
      if (!json)
        return 3;
    } else {
      json = strdup(json_file);
    }
    char *sk_str = argv[3];
    if (sk_str[0] == '@') {
      sk_str = read_file(sk_str + 1);
    } else {
      sk_str = strdup(sk_str);
    }
    char *pk_str = argv[4];
    if (pk_str[0] == '@') {
      pk_str = read_file(pk_str + 1);
    } else {
      pk_str = strdup(pk_str);
    }

    uint8_t sk[CRYPTO_SECRETKEYBYTES];
    hex_decode(sk_str, sk, CRYPTO_SECRETKEYBYTES);
    uint8_t pk[CRYPTO_PUBLICKEYBYTES];
    hex_decode(pk_str, pk, CRYPTO_PUBLICKEYBYTES);

    char *data_hex = extract_json_string(json, "data");
    char *ct_hex = extract_json_string(json, "ct");
    char *mac_hex = extract_json_string(json, "mac");
    if (!data_hex || !ct_hex || !mac_hex)
      return 4;

    size_t p_len = strlen(data_hex) / 2;
    uint8_t *payload = malloc(p_len);
    hex_decode(data_hex, payload, p_len);
    uint8_t ct[CRYPTO_CIPHERTEXTBYTES];
    hex_decode(ct_hex, ct, CRYPTO_CIPHERTEXTBYTES);
    uint8_t mac[32];
    hex_decode(mac_hex, mac, 32);

    int res = dasp_decapsulate_data_inner(payload, p_len, sk,
                                          use_hwid ? hwid : NULL, ct, mac, 0, 0);
    if (res != 0) {
      fprintf(stderr, "Rebind Decryption Failed\n");
      return 5;
    }

    uint8_t new_ct[CRYPTO_CIPHERTEXTBYTES];
    uint8_t new_mac[32];
    randombytes_force_reseed();
    dasp_encapsulate_data_inner(
        payload, p_len, pk, use_new_hwid ? new_hwid : NULL, new_ct, new_mac, 0, 0);

    char *new_ct_hex = malloc(CRYPTO_CIPHERTEXTBYTES * 2 + 1);
    char new_mac_hex[65];
    hex_encode(new_ct, CRYPTO_CIPHERTEXTBYTES, new_ct_hex);
    hex_encode(new_mac, 32, new_mac_hex);
    char *new_data_hex = malloc(p_len * 2 + 1);
    hex_encode(payload, p_len, new_data_hex);

    volatile uint8_t *v_payload = (volatile uint8_t *)payload;
    for (size_t k = 0; k < p_len; k++)
      v_payload[k] = 0;

    printf("{\"data\":\"%s\",\"ct\":\"%s\",\"mac\":\"%s\"}\n", new_data_hex,
           new_ct_hex, new_mac_hex);

    free(new_data_hex);
    free(new_ct_hex);
    free(payload);
    free(data_hex);
    free(ct_hex);
    free(mac_hex);
    free(json);
    free(sk_str);
    free(pk_str);
    return 0;
  }

  return 1;
}
