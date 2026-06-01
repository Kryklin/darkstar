#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "dasp_cuda.h"

extern "C" {
    #include "api.h"
    #include "ml_kem.h"
    #include "sha512.h"
    #include "sha256.h"
}

/* --- Utility Functions Ported from C Reference --- */

static void hex_decode(const char *in, uint8_t *out, size_t out_len) {
    if (in[0] == '@') {
        // Handle @file syntax internally if needed, but the Python script sends @path 
        // to the CLI, and our read_file handles it. This should be a direct hex string here.
    }
    for (size_t i = 0; i < out_len; i++) {
        sscanf(in + i * 2, "%2hhx", &out[i]);
    }
}

static char *read_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = (char*)malloc(len + 1);
    fread(buf, 1, len, f);
    buf[len] = '\0';
    fclose(f);
    return buf;
}

static char *extract_json_string(const char *json, const char *key) {
    char search_key[64];
    sprintf(search_key, "\"%s\"", key);
    const char *ptr = strstr(json, search_key);
    if (!ptr) return NULL;
    ptr = strchr(ptr, ':');
    if (!ptr) return NULL;
    ptr = strchr(ptr, '"');
    if (!ptr) return NULL;
    ptr++;
    const char *end = strchr(ptr, '"');
    if (!end) return NULL;
    size_t len = end - ptr;
    char *res = (char*)malloc(len + 1);
    memcpy(res, ptr, len);
    res[len] = '\0';
    return res;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s decrypt <json> <sk_hex> [--hwid <hwid_hex>]\n"
                        "       %s encrypt <payload> <pk_hex> [--hwid <hwid_hex>]\n"
                        "       %s benchmark <gigabytes> [--hwid <hwid_hex>]\n", argv[0], argv[0], argv[0]);
        return 1;
    }

    dasp_cuda_init();

    if (strcmp(argv[1], "decrypt") == 0) {
        if (argc < 4) return 1;
        
        char *json_raw = argv[2];
        if (json_raw[0] == '@') json_raw = read_file(json_raw + 1);
        
        char *sk_raw = argv[3];
        if (sk_raw[0] == '@') sk_raw = read_file(sk_raw + 1);

        uint8_t hwid[32];
        int has_hwid = 0;
        int use_telemetry = 0;
        for (int i = 4; i < argc; i++) {
            if (strcmp(argv[i], "--hwid") == 0 && i + 1 < argc) {
                char *h = argv[i+1];
                char *h_to_free = NULL;
                if (h[0] == '@') {
                    h = read_file(h+1);
                    h_to_free = h;
                }
                hex_decode(h, hwid, 32);
                has_hwid = 1;
                if(h_to_free) free(h_to_free);
            }
            if (strcmp(argv[i], "--telemetry") == 0) {
                use_telemetry = 1;
            }
        }

        char *data_hex = extract_json_string(json_raw, "data");
        char *ct_hex = extract_json_string(json_raw, "ct");
        char *mac_hex = extract_json_string(json_raw, "mac");

        size_t p_len = strlen(data_hex) / 2;
        uint8_t *h_payload;
        CUDA_CHECK(cudaMallocHost((void**)&h_payload, p_len + 1));
        hex_decode(data_hex, h_payload, p_len);

        uint8_t sk[CRYPTO_SECRETKEYBYTES];
        hex_decode(sk_raw, sk, CRYPTO_SECRETKEYBYTES);

        uint8_t ct[CRYPTO_CIPHERTEXTBYTES];
        hex_decode(ct_hex, ct, CRYPTO_CIPHERTEXTBYTES);

        uint8_t mac_in[32];
        hex_decode(mac_hex, mac_in, 32);

        /* --- Host-Side Decapsulation & KDF --- */
        uint8_t ss[32];
        crypto_kem_dec(ss, ct, sk);

        uint8_t blended_ss[32];
        {
            uint8_t prk[32];
            if (has_hwid) {
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
            uint8_t c[38]; memcpy(c, "cipher", 6); memcpy(c+6, blended_ss, 32);
            crypto_sha256(c, 38, cipher_key);
        }
        uint8_t hmac_key[32];
        {
            uint8_t c[36]; memcpy(c, "hmac", 4); memcpy(c+4, blended_ss, 32);
            crypto_sha256(c, 36, hmac_key);
        }
        
        char cipher_key_hex[65];
        for(int i=0; i<32; i++) sprintf(&cipher_key_hex[i*2], "%02x", cipher_key[i]);
        
        uint8_t word_key[32];
        crypto_hmac_sha256((uint8_t*)cipher_key_hex, 64, (uint8_t*)"dasp-word-0", 11, word_key);
        
        uint8_t func_key[32];
        int chk = 66; // generate_checksum(0..11) = 66
        char chk_str[64]; sprintf(chk_str, "keyed-%d", chk);
        crypto_hmac_sha256(word_key, 32, (uint8_t*)chk_str, strlen(chk_str), func_key);

        char word_key_hex[65];
        for(int i=0; i<32; i++) sprintf(&word_key_hex[i*2], "%02x", word_key[i]);

        uint8_t prng_seed[64];
        crypto_sha512((uint8_t*)word_key_hex, 64, prng_seed);

        uint8_t h_keys[128];
        memcpy(h_keys, func_key, 32);
        memcpy(h_keys + 64, prng_seed, 64);
        
        /* MAC Verification */
        uint8_t *mac_content = (uint8_t*)malloc(CRYPTO_CIPHERTEXTBYTES + p_len);
        memcpy(mac_content, ct, CRYPTO_CIPHERTEXTBYTES);
        memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES, h_payload, p_len);
        uint8_t actual_mac[32];
        crypto_hmac_sha256(hmac_key, 32, mac_content, CRYPTO_CIPHERTEXTBYTES + p_len, actual_mac);
        free(mac_content);

        uint8_t mac_diff = 0;
        for(int i = 0; i < 32; i++) mac_diff |= mac_in[i] ^ actual_mac[i];
        if(mac_diff != 0) {
            fprintf(stderr, "CUDA-DASP: MAC Verification Failed\n");
            fprintf(stderr, "Expected: ");
            for(int i=0; i<32; i++) fprintf(stderr, "%02x", mac_in[i]);
            fprintf(stderr, "\nActual: ");
            for(int i=0; i<32; i++) fprintf(stderr, "%02x", actual_mac[i]);
            fprintf(stderr, "\n");
            return -1;
        }

        /* Generate Nonce (chain_state) for CTR Mode */
        uint8_t chain_state[32];
        {
            char buf[256];
            sprintf(buf, "dasp-chain-%s", cipher_key_hex);
            crypto_sha256((uint8_t*)buf, strlen(buf), chain_state);
        }

        /* Initialize CUDA Context explicitly to bypass WDDM cold-start in benchmark */
        CUDA_CHECK(cudaFree(0));

        /* --- CUDA Launch with Streams --- */
        cudaEvent_t start_event, stop_event;
        CUDA_CHECK(cudaEventCreate(&start_event));
        CUDA_CHECK(cudaEventCreate(&stop_event));

        int num_streams = 2;
        cudaStream_t streams[2];
        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaStreamCreate(&streams[i]));
        }

        uint8_t *d_payload, *d_keys, *d_nonce;
        CUDA_CHECK(cudaMalloc(&d_payload, p_len));
        CUDA_CHECK(cudaMalloc(&d_keys, 128));
        CUDA_CHECK(cudaMalloc(&d_nonce, 32));
        
        CUDA_CHECK(cudaMemcpy(d_keys, h_keys, 128, cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(d_nonce, chain_state, 32, cudaMemcpyHostToDevice));
        
        dasp_cuda_init_keys(d_keys);

        CUDA_CHECK(cudaEventRecord(start_event, 0));

        if (p_len > 0) {
            size_t chunk_size = (p_len + num_streams - 1) / num_streams;
            chunk_size = (chunk_size + 31) & ~31; // Align to 32 bytes

            for (int i = 0; i < num_streams; i++) {
                size_t offset = i * chunk_size;
                if (offset >= p_len) break;
                
                size_t current_chunk_size = p_len - offset;
                if (current_chunk_size > chunk_size) current_chunk_size = chunk_size;

                CUDA_CHECK(cudaMemcpyAsync(d_payload + offset, h_payload + offset, current_chunk_size, cudaMemcpyHostToDevice, streams[i]));
                dasp_cuda_process_chunk(d_payload + offset, current_chunk_size, d_nonce, offset / 32, streams[i]);
                CUDA_CHECK(cudaMemcpyAsync(h_payload + offset, d_payload + offset, current_chunk_size, cudaMemcpyDeviceToHost, streams[i]));
            }

            for (int i = 0; i < num_streams; i++) {
                CUDA_CHECK(cudaStreamSynchronize(streams[i]));
            }
        }
        
        CUDA_CHECK(cudaEventRecord(stop_event, 0));
        CUDA_CHECK(cudaEventSynchronize(stop_event));
        
        float cascade_ms = 0;
        CUDA_CHECK(cudaEventElapsedTime(&cascade_ms, start_event, stop_event));
        uint64_t cascade_us = (uint64_t)(cascade_ms * 1000.0f);
        
        /* Output Result */
        char *final_plaintext = (char*)malloc(p_len + 1);
        memcpy(final_plaintext, h_payload, p_len);
        final_plaintext[p_len] = '\0';
        printf("%s\n", final_plaintext);
        free(final_plaintext);

        /* Diagnostics (Matching KAT requirements) */
        char blended_hex[65], mac_in_hex_diagnostic[65], mac_actual_hex[65];
        for(int i=0; i<32; i++) sprintf(&blended_hex[i*2], "%02x", blended_ss[i]);
        // [word_key_hex already defined above]
        for(int i=0; i<32; i++) sprintf(&mac_in_hex_diagnostic[i*2], "%02x", mac_in[i]);
        for(int i=0; i<32; i++) sprintf(&mac_actual_hex[i*2], "%02x", actual_mac[i]);
        
        fprintf(stderr, "{\"diagnostics\":{\"stage1_blended_ss\":\"%s\",\"stage2_word_key\":\"%s\",\"stage4_mac_in\":\"%s\",\"stage4_mac\":\"%s\"}}\n", 
               blended_hex, word_key_hex, mac_in_hex_diagnostic, mac_actual_hex);
        
        if (use_telemetry) {
            fprintf(stderr, "{\"timings\":{\"cascade_us\":%llu}}\n", cascade_us);
        }

        /* Cleanup */
        CUDA_CHECK(cudaEventDestroy(start_event));
        CUDA_CHECK(cudaEventDestroy(stop_event));
        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaStreamDestroy(streams[i]));
        }
        CUDA_CHECK(cudaFree(d_payload));
        CUDA_CHECK(cudaFree(d_keys));
        CUDA_CHECK(cudaFree(d_nonce));
        free(data_hex); free(ct_hex); free(mac_hex);
        CUDA_CHECK(cudaFreeHost(h_payload));
        if (argv[2][0] == '@') free(json_raw);
        if (argv[3][0] == '@') free(sk_raw);
    } else if (strcmp(argv[1], "encrypt") == 0) {
        if (argc < 4) return 1;
        
        char *payload_raw = argv[2];
        if (payload_raw[0] == '@') payload_raw = read_file(payload_raw + 1);
        
        char *pk_raw = argv[3];
        if (pk_raw[0] == '@') pk_raw = read_file(pk_raw + 1);

        uint8_t hwid[32];
        int has_hwid = 0;
        int use_telemetry = 0;
        for (int i = 4; i < argc; i++) {
            if (strcmp(argv[i], "--hwid") == 0 && i + 1 < argc) {
                char *h = argv[i+1];
                char *h_to_free = NULL;
                if (h[0] == '@') {
                    h = read_file(h+1);
                    h_to_free = h;
                }
                hex_decode(h, hwid, 32);
                has_hwid = 1;
                if(h_to_free) free(h_to_free);
            }
            if (strcmp(argv[i], "--telemetry") == 0) {
                use_telemetry = 1;
            }
        }

        size_t p_len = strlen(payload_raw);
        uint8_t *h_payload;
        CUDA_CHECK(cudaMallocHost((void**)&h_payload, p_len + 1));
        memcpy(h_payload, payload_raw, p_len);

        uint8_t pk[CRYPTO_PUBLICKEYBYTES];
        hex_decode(pk_raw, pk, CRYPTO_PUBLICKEYBYTES);

        uint8_t ct[CRYPTO_CIPHERTEXTBYTES];

        /* --- Host-Side Encapsulation & KDF --- */
        uint8_t ss[32];
        crypto_kem_enc(ct, ss, pk);

        uint8_t blended_ss[32];
        {
            uint8_t prk[32];
            if (has_hwid) {
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
            uint8_t c[38]; memcpy(c, "cipher", 6); memcpy(c+6, blended_ss, 32);
            crypto_sha256(c, 38, cipher_key);
        }
        uint8_t hmac_key[32];
        {
            uint8_t c[36]; memcpy(c, "hmac", 4); memcpy(c+4, blended_ss, 32);
            crypto_sha256(c, 36, hmac_key);
        }
        
        char cipher_key_hex[65];
        for(int i=0; i<32; i++) sprintf(&cipher_key_hex[i*2], "%02x", cipher_key[i]);
        
        uint8_t word_key[32];
        crypto_hmac_sha256((uint8_t*)cipher_key_hex, 64, (uint8_t*)"dasp-word-0", 11, word_key);
        
        uint8_t func_key[32];
        int chk = 66; // generate_checksum(0..11) = 66
        char chk_str[64]; sprintf(chk_str, "keyed-%d", chk);
        crypto_hmac_sha256(word_key, 32, (uint8_t*)chk_str, strlen(chk_str), func_key);

        char word_key_hex[65];
        for(int i=0; i<32; i++) sprintf(&word_key_hex[i*2], "%02x", word_key[i]);

        uint8_t prng_seed[64];
        crypto_sha512((uint8_t*)word_key_hex, 64, prng_seed);

        uint8_t h_keys[128];
        memcpy(h_keys, func_key, 32);
        memcpy(h_keys + 64, prng_seed, 64);
        
        /* Generate Nonce (chain_state) for CTR Mode */
        uint8_t chain_state[32];
        {
            char buf[256];
            sprintf(buf, "dasp-chain-%s", cipher_key_hex);
            crypto_sha256((uint8_t*)buf, strlen(buf), chain_state);
        }

        /* Initialize CUDA Context explicitly to bypass WDDM cold-start in benchmark */
        CUDA_CHECK(cudaFree(0));

        /* --- CUDA Launch with Streams --- */
        cudaEvent_t start_event, stop_event;
        CUDA_CHECK(cudaEventCreate(&start_event));
        CUDA_CHECK(cudaEventCreate(&stop_event));

        int num_streams = 2;
        cudaStream_t streams[2];
        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaStreamCreate(&streams[i]));
        }

        uint8_t *d_payload, *d_keys, *d_nonce;
        CUDA_CHECK(cudaMalloc(&d_payload, p_len));
        CUDA_CHECK(cudaMalloc(&d_keys, 128));
        CUDA_CHECK(cudaMalloc(&d_nonce, 32));
        
        CUDA_CHECK(cudaMemcpy(d_keys, h_keys, 128, cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(d_nonce, chain_state, 32, cudaMemcpyHostToDevice));
        
        dasp_cuda_init_keys(d_keys);

        CUDA_CHECK(cudaEventRecord(start_event, 0));

        if (p_len > 0) {
            size_t chunk_size = (p_len + num_streams - 1) / num_streams;
            chunk_size = (chunk_size + 31) & ~31; // Align to 32 bytes

            for (int i = 0; i < num_streams; i++) {
                size_t offset = i * chunk_size;
                if (offset >= p_len) break;
                
                size_t current_chunk_size = p_len - offset;
                if (current_chunk_size > chunk_size) current_chunk_size = chunk_size;

                CUDA_CHECK(cudaMemcpyAsync(d_payload + offset, h_payload + offset, current_chunk_size, cudaMemcpyHostToDevice, streams[i]));
                dasp_cuda_process_chunk(d_payload + offset, current_chunk_size, d_nonce, offset / 32, streams[i]);
                CUDA_CHECK(cudaMemcpyAsync(h_payload + offset, d_payload + offset, current_chunk_size, cudaMemcpyDeviceToHost, streams[i]));
            }

            for (int i = 0; i < num_streams; i++) {
                CUDA_CHECK(cudaStreamSynchronize(streams[i]));
            }
        }
        
        CUDA_CHECK(cudaEventRecord(stop_event, 0));
        CUDA_CHECK(cudaEventSynchronize(stop_event));
        
        float cascade_ms = 0;
        CUDA_CHECK(cudaEventElapsedTime(&cascade_ms, start_event, stop_event));
        uint64_t cascade_us = (uint64_t)(cascade_ms * 1000.0f);

        /* Generate MAC after GPU execution */
        uint8_t *mac_content = (uint8_t*)malloc(CRYPTO_CIPHERTEXTBYTES + p_len);
        memcpy(mac_content, ct, CRYPTO_CIPHERTEXTBYTES);
        memcpy(mac_content + CRYPTO_CIPHERTEXTBYTES, h_payload, p_len);
        uint8_t actual_mac[32];
        crypto_hmac_sha256(hmac_key, 32, mac_content, CRYPTO_CIPHERTEXTBYTES + p_len, actual_mac);
        free(mac_content);
        
        /* Output Result */
        char *ct_hex = (char*)malloc(CRYPTO_CIPHERTEXTBYTES * 2 + 1);
        for(int i=0; i<CRYPTO_CIPHERTEXTBYTES; i++) sprintf(&ct_hex[i*2], "%02x", ct[i]);
        
        char *data_hex = (char*)malloc(p_len * 2 + 1);
        for(size_t i=0; i<p_len; i++) sprintf(&data_hex[i*2], "%02x", h_payload[i]);
        
        char mac_hex[65];
        for(int i=0; i<32; i++) sprintf(&mac_hex[i*2], "%02x", actual_mac[i]);
        
        printf("{\"data\":\"%s\",\"ct\":\"%s\",\"mac\":\"%s\"}\n", data_hex, ct_hex, mac_hex);

        /* Diagnostics (Matching KAT requirements) */
        char blended_hex[65];
        for(int i=0; i<32; i++) sprintf(&blended_hex[i*2], "%02x", blended_ss[i]);
        // [word_key_hex already defined above]
        
        fprintf(stderr, "{\"diagnostics\":{\"stage1_blended_ss\":\"%s\",\"stage2_word_key\":\"%s\",\"stage4_mac_in\":\"%s\",\"stage4_mac\":\"%s\"}}\n", 
               blended_hex, word_key_hex, mac_hex, mac_hex);
        
        if (use_telemetry) {
            fprintf(stderr, "{\"timings\":{\"cascade_us\":%llu}}\n", cascade_us);
        }

        /* Cleanup */
        CUDA_CHECK(cudaEventDestroy(start_event));
        CUDA_CHECK(cudaEventDestroy(stop_event));
        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaStreamDestroy(streams[i]));
        }
        CUDA_CHECK(cudaFree(d_payload));
        CUDA_CHECK(cudaFree(d_keys));
        CUDA_CHECK(cudaFree(d_nonce));
        free(data_hex); free(ct_hex);
        CUDA_CHECK(cudaFreeHost(h_payload));
        if (argv[2][0] == '@') free(payload_raw);
        if (argv[3][0] == '@') free(pk_raw);
    } else if (strcmp(argv[1], "benchmark") == 0) {
        if (argc < 3) return 1;
        float gb = atof(argv[2]);
        if (gb <= 0) return 1;
        size_t total_bytes = (size_t)(gb * 1024.0 * 1024.0 * 1024.0);

        uint8_t hwid[32] = {0};
        int has_hwid = 0;
        for (int i = 3; i < argc; i++) {
            if (strcmp(argv[i], "--hwid") == 0 && i + 1 < argc) {
                hex_decode(argv[i+1], hwid, 32);
                has_hwid = 1;
            }
        }

        /* Mock PK */
        uint8_t pk[CRYPTO_PUBLICKEYBYTES] = {0};
        uint8_t ct[CRYPTO_CIPHERTEXTBYTES];
        uint8_t ss[32];
        crypto_kem_enc(ct, ss, pk);

        /* KDF */
        uint8_t blended_ss[32];
        {
            uint8_t prk[32];
            if (has_hwid) {
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
            uint8_t c[38]; memcpy(c, "cipher", 6); memcpy(c+6, blended_ss, 32);
            crypto_sha256(c, 38, cipher_key);
        }
        
        char cipher_key_hex[65];
        for(int i=0; i<32; i++) sprintf(&cipher_key_hex[i*2], "%02x", cipher_key[i]);
        
        uint8_t word_key[32];
        crypto_hmac_sha256((uint8_t*)cipher_key_hex, 64, (uint8_t*)"dasp-word-0", 11, word_key);
        
        uint8_t func_key[32];
        char chk_str[64]; sprintf(chk_str, "keyed-%d", 66);
        crypto_hmac_sha256(word_key, 32, (uint8_t*)chk_str, strlen(chk_str), func_key);

        char word_key_hex[65];
        for(int i=0; i<32; i++) sprintf(&word_key_hex[i*2], "%02x", word_key[i]);

        uint8_t prng_seed[64];
        crypto_sha512((uint8_t*)word_key_hex, 64, prng_seed);

        uint8_t h_keys[128];
        memcpy(h_keys, func_key, 32);
        memcpy(h_keys + 64, prng_seed, 64);
        
        uint8_t chain_state[32];
        {
            char buf[256];
            sprintf(buf, "dasp-chain-%s", cipher_key_hex);
            crypto_sha256((uint8_t*)buf, strlen(buf), chain_state);
        }

        CUDA_CHECK(cudaFree(0));

        int num_streams = 4; // Use 4 streams for pipeline saturation
        cudaStream_t streams[4];
        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaStreamCreate(&streams[i]));
        }

        size_t chunk_size = 64 * 1024 * 1024; // 64 MB chunk per stream
        uint8_t *h_payload[4], *d_payload[4];
        uint8_t *d_keys, *d_nonce;

        CUDA_CHECK(cudaMalloc(&d_keys, 128));
        CUDA_CHECK(cudaMalloc(&d_nonce, 32));
        CUDA_CHECK(cudaMemcpy(d_keys, h_keys, 128, cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(d_nonce, chain_state, 32, cudaMemcpyHostToDevice));
        dasp_cuda_init_keys(d_keys);

        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaMallocHost((void**)&h_payload[i], chunk_size));
            CUDA_CHECK(cudaMalloc(&d_payload[i], chunk_size));
            // Initialize host payload just to avoid random uninitialized data impacting anything
            memset(h_payload[i], 0x01, chunk_size);
        }

        cudaEvent_t start_event, stop_event;
        CUDA_CHECK(cudaEventCreate(&start_event));
        CUDA_CHECK(cudaEventCreate(&stop_event));

        fprintf(stderr, "CUDA-DASP: Starting Streaming Benchmark for %.2f GB\n", gb);
        CUDA_CHECK(cudaEventRecord(start_event, 0));

        size_t processed_bytes = 0;
        int stream_idx = 0;
        
        while (processed_bytes < total_bytes) {
            size_t current_chunk = total_bytes - processed_bytes;
            if (current_chunk > chunk_size) current_chunk = chunk_size;

            CUDA_CHECK(cudaMemcpyAsync(d_payload[stream_idx], h_payload[stream_idx], current_chunk, cudaMemcpyHostToDevice, streams[stream_idx]));
            dasp_cuda_process_chunk(d_payload[stream_idx], current_chunk, d_nonce, processed_bytes / 32, streams[stream_idx]);
            CUDA_CHECK(cudaMemcpyAsync(h_payload[stream_idx], d_payload[stream_idx], current_chunk, cudaMemcpyDeviceToHost, streams[stream_idx]));
            
            processed_bytes += current_chunk;
            stream_idx = (stream_idx + 1) % num_streams;
        }

        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaStreamSynchronize(streams[i]));
        }
        
        CUDA_CHECK(cudaEventRecord(stop_event, 0));
        CUDA_CHECK(cudaEventSynchronize(stop_event));
        
        float pipeline_ms = 0;
        CUDA_CHECK(cudaEventElapsedTime(&pipeline_ms, start_event, stop_event));
        
        float pipeline_throughput = (total_bytes / (1024.0 * 1024.0 * 1024.0)) / (pipeline_ms / 1000.0);

        /* Pure GPU Compute Benchmark */
        cudaEvent_t compute_start, compute_stop;
        CUDA_CHECK(cudaEventCreate(&compute_start));
        CUDA_CHECK(cudaEventCreate(&compute_stop));

        fprintf(stderr, "CUDA-DASP: Running Pure GPU Compute Benchmark for %.2f GB\n", gb);
        CUDA_CHECK(cudaEventRecord(compute_start, 0));

        processed_bytes = 0;
        stream_idx = 0;
        while (processed_bytes < total_bytes) {
            size_t current_chunk = total_bytes - processed_bytes;
            if (current_chunk > chunk_size) current_chunk = chunk_size;

            dasp_cuda_process_chunk(d_payload[stream_idx], current_chunk, d_nonce, processed_bytes / 32, streams[stream_idx]);
            
            processed_bytes += current_chunk;
            stream_idx = (stream_idx + 1) % num_streams;
        }

        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaStreamSynchronize(streams[i]));
        }
        
        CUDA_CHECK(cudaEventRecord(compute_stop, 0));
        CUDA_CHECK(cudaEventSynchronize(compute_stop));

        float compute_ms = 0;
        CUDA_CHECK(cudaEventElapsedTime(&compute_ms, compute_start, compute_stop));
        
        float compute_throughput = (total_bytes / (1024.0 * 1024.0 * 1024.0)) / (compute_ms / 1000.0);
        
        printf("{\n");
        printf("  \"target_gb\": %.2f,\n", gb);
        printf("  \"pipeline_ms\": %.2f,\n", pipeline_ms);
        printf("  \"pipeline_gb_s\": %.2f,\n", pipeline_throughput);
        printf("  \"compute_ms\": %.2f,\n", compute_ms);
        printf("  \"compute_gb_s\": %.2f\n", compute_throughput);
        printf("}\n");

        CUDA_CHECK(cudaEventDestroy(compute_start));
        CUDA_CHECK(cudaEventDestroy(compute_stop));

        for (int i = 0; i < num_streams; i++) {
            CUDA_CHECK(cudaFreeHost(h_payload[i]));
            CUDA_CHECK(cudaFree(d_payload[i]));
            CUDA_CHECK(cudaStreamDestroy(streams[i]));
        }
        CUDA_CHECK(cudaFree(d_keys));
        CUDA_CHECK(cudaFree(d_nonce));
        CUDA_CHECK(cudaEventDestroy(start_event));
        CUDA_CHECK(cudaEventDestroy(stop_event));
    }

    return 0;
}
