/**
 * @file dasp_cuda.h
 * @brief Host/Device interface for the CUDA-accelerated D-ASP (ASP Cascade 16) engine.
 */

#ifndef DASP_CUDA_H
#define DASP_CUDA_H

#include <stdint.h>
#include <cuda_runtime.h>

#define DASP_ROUNDS 16
#define DASP_BLOCK_SIZE 64
#define DASP_SHARED_SECRET_BYTES 32
#define DASP_SBOX_SIZE 256

/**
 * @brief CUDA Error Checking Macro.
 */
#define CUDA_CHECK(call) \
    do { \
        cudaError_t err = call; \
        if (err != cudaSuccess) { \
            fprintf(stderr, "CUDA Error: %s at %s:%d\n", cudaGetErrorString(err), __FILE__, __LINE__); \
            exit(EXIT_FAILURE); \
        } \
    } while (0)

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initializes CUDA constant memory.
 */
void dasp_cuda_init();

/**
 * @brief Launches the D-ASP bulk encryption kernel on the GPU.
 * 
 * @param d_payload     Device pointer to payload buffer.
 * @param payload_len   Total length of payloads to process.
 * @param d_keys_128    Device pointer to the 128-byte key buffer (func_key + prng_seed).
 * @param d_hwid        Device pointer to the hardware ID.
 * @param num_blocks    For bulk mode (not yet used, set to 1).
 * @param is_forward    1 for encryption, 0 for decryption.
 */
void dasp_cuda_process_blocks(uint8_t *d_payload, 
                             size_t payload_len, 
                             const uint8_t *d_keys_128, 
                             const uint8_t *d_hwid, 
                             size_t num_blocks, 
                             int is_forward);

#ifdef __cplusplus
}
#endif

#endif // DASP_CUDA_H
