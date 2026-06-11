#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "dasp_cuda.h"

int main(int argc, char **argv) {
    int telemetry = 0;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--telemetry") == 0) telemetry = 1;
    }

    if (!telemetry) {
        printf("--- D-ASP CUDA Verification Tool (Sweep Benchmark) ---\n");
    }

    size_t sizes_mb[] = {1, 16, 64, 128, 256, 512};
    int num_sizes = sizeof(sizes_mb) / sizeof(sizes_mb[0]);

    dasp_cuda_init();
    
    // Allocate max buffer size upfront
    size_t max_payload_len = sizes_mb[num_sizes - 1] * 1024 * 1024;
    
    uint8_t *h_payload = (uint8_t*)malloc(max_payload_len);
    uint8_t *h_verify = (uint8_t*)malloc(max_payload_len);
    for(size_t i=0; i<max_payload_len; i++) h_payload[i] = i & 0xFF;
    memcpy(h_verify, h_payload, max_payload_len);

    uint8_t h_keys[128];
    memset(h_keys, 0x42, 128); // Sample key + seed

    uint8_t h_nonce[32];
    memset(h_nonce, 0x11, 32);

    uint8_t *d_payload, *d_keys, *d_nonce;
    CUDA_CHECK(cudaMalloc(&d_payload, max_payload_len));
    CUDA_CHECK(cudaMalloc(&d_keys, 128));
    CUDA_CHECK(cudaMalloc(&d_nonce, 32));

    CUDA_CHECK(cudaMemcpy(d_payload, h_payload, max_payload_len, cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_keys, h_keys, 128, cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_nonce, h_nonce, 32, cudaMemcpyHostToDevice));

    dasp_cuda_init_keys(d_keys);

    cudaEvent_t start_event, stop_event;
    CUDA_CHECK(cudaEventCreate(&start_event));
    CUDA_CHECK(cudaEventCreate(&stop_event));

    int global_match = 1;

    for (int i = 0; i < num_sizes; i++) {
        size_t current_mb = sizes_mb[i];
        size_t current_payload_len = current_mb * 1024 * 1024;

        if (telemetry) {
            printf("{\"progress\": %d, \"total\": %d, \"size_mb\": %zu, \"action\": \"Encrypting\"}\n", i*2, num_sizes*2, current_mb);
            fflush(stdout);
        } else {
            printf("\nTesting %zu MB...\n", current_mb);
        }

        CUDA_CHECK(cudaEventRecord(start_event, 0));
        dasp_cuda_process_chunk(d_payload, current_payload_len, d_nonce, 0, 0, 0, NULL);
        CUDA_CHECK(cudaEventRecord(stop_event, 0));
        CUDA_CHECK(cudaEventSynchronize(stop_event));

        float enc_ms = 0;
        CUDA_CHECK(cudaEventElapsedTime(&enc_ms, start_event, stop_event));
        double enc_time = enc_ms / 1000.0;
        double enc_gbps = (current_payload_len * 8.0) / (enc_time * 1e9);

        if (telemetry) {
            printf("{\"progress\": %d, \"total\": %d, \"size_mb\": %zu, \"action\": \"Decrypting\"}\n", i*2 + 1, num_sizes*2, current_mb);
            fflush(stdout);
        }

        CUDA_CHECK(cudaEventRecord(start_event, 0));
        dasp_cuda_process_chunk(d_payload, current_payload_len, d_nonce, 0, 0, 0, NULL);
        CUDA_CHECK(cudaEventRecord(stop_event, 0));
        CUDA_CHECK(cudaEventSynchronize(stop_event));

        float dec_ms = 0;
        CUDA_CHECK(cudaEventElapsedTime(&dec_ms, start_event, stop_event));
        double dec_time = dec_ms / 1000.0;
        double dec_gbps = (current_payload_len * 8.0) / (dec_time * 1e9);

        CUDA_CHECK(cudaMemcpy(h_payload, d_payload, current_payload_len, cudaMemcpyDeviceToHost));
        int match = 1;
        for(size_t j=0; j<current_payload_len; j++) {
            if(h_payload[j] != h_verify[j]) {
                match = 0;
                global_match = 0;
                break;
            }
        }

        if (telemetry) {
            printf("{\"result\": true, \"size_mb\": %zu, \"enc_gbps\": %.2f, \"dec_gbps\": %.2f, \"match\": %s}\n", 
                current_mb, enc_gbps, dec_gbps, match ? "true" : "false");
            fflush(stdout);
        } else {
            printf("  Enc: %.2f Gbps | Dec: %.2f Gbps | Match: %s\n", enc_gbps, dec_gbps, match ? "PASS" : "FAIL");
        }
    }

    CUDA_CHECK(cudaEventDestroy(start_event));
    CUDA_CHECK(cudaEventDestroy(stop_event));
    CUDA_CHECK(cudaFree(d_payload));
    CUDA_CHECK(cudaFree(d_keys));
    CUDA_CHECK(cudaFree(d_nonce));
    free(h_payload);
    free(h_verify);

    return global_match ? 0 : 1;
}
