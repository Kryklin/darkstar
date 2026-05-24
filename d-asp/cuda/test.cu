#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "dasp_cuda.h"

int main() {
    printf("--- D-ASP CUDA Verification Tool ---\n");

    const size_t num_blocks = 1024 * 1024; // 1M blocks (64MB)
    const size_t payload_len = num_blocks * DASP_BLOCK_SIZE;
    
    printf("Allocating %zu MB of host memory...\n", payload_len / (1024 * 1024));
    uint8_t *h_payload = (uint8_t*)malloc(payload_len);
    uint8_t *h_verify = (uint8_t*)malloc(payload_len);
    
    // Fill with random data
    for(size_t i=0; i<payload_len; i++) h_payload[i] = i & 0xFF;
    memcpy(h_verify, h_payload, payload_len);

    uint8_t h_key[32];
    memset(h_key, 0x42, 32); // Sample key

    uint8_t *d_payload, *d_key;
    CUDA_CHECK(cudaMalloc(&d_payload, payload_len));
    CUDA_CHECK(cudaMalloc(&d_key, 32));

    printf("Copying data to device...\n");
    CUDA_CHECK(cudaMemcpy(d_payload, h_payload, payload_len, cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_key, h_key, 32, cudaMemcpyHostToDevice));

    printf("Launching D-ASP Kernel (Encryption)...\n");
    clock_t start = clock();
    dasp_cuda_process_blocks(d_payload, payload_len, d_key, NULL, num_blocks, 1);
    clock_t end = clock();
    
    double time_taken = (double)(end - start) / CLOCKS_PER_SEC;
    double gbps = (payload_len * 8.0) / (time_taken * 1e9);
    printf("Encryption completed in %.4f seconds (%.2f Gbps)\n", time_taken, gbps);

    printf("Launching D-ASP Kernel (Decryption)...\n");
    dasp_cuda_process_blocks(d_payload, payload_len, d_key, NULL, num_blocks, 0);

    printf("Copying result back to host...\n");
    CUDA_CHECK(cudaMemcpy(h_payload, d_payload, payload_len, cudaMemcpyDeviceToHost));

    printf("Verifying bit-perfect integrity...\n");
    int match = 1;
    for(size_t i=0; i<payload_len; i++) {
        if(h_payload[i] != h_verify[i]) {
            printf("MISMATCH at index %zu: Expected %02x, Got %02x\n", i, h_verify[i], h_payload[i]);
            match = 0;
            break;
        }
    }

    if(match) {
        printf("SUCCESS: CUDA kernel passed bit-perfect loopback test!\n");
    } else {
        printf("FAILURE: Data corruption detected.\n");
    }

    CUDA_CHECK(cudaFree(d_payload));
    CUDA_CHECK(cudaFree(d_key));
    free(h_payload);
    free(h_verify);

    return match ? 0 : 1;
}
