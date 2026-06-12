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
 * @brief Initializes the round keys in device memory.
 * 
 * @param d_keys_128    Device pointer to the 128-byte key buffer (func_key + prng_seed).
 */
void dasp_cuda_init_keys(const uint8_t *d_keys_128);

/**
 * @brief Launches the D-ASP bulk encryption kernel on the GPU using a specific stream.
 * 
 * @param d_payload     Device pointer to payload buffer chunk.
 * @param chunk_len     Length of the chunk to process.
 * @param d_nonce       Device pointer to the base nonce.
 * @param block_offset  Global block index offset for CTR mode.
 * @param stream        CUDA stream to use for asynchronous execution.
 */
void dasp_cuda_process_chunk(uint8_t *d_payload, 
                             size_t chunk_len, 
                             const uint8_t *d_nonce, 
                             uint64_t block_offset, 
                             cudaStream_t stream,
                             int dpa_triggered,
                             const uint8_t *prng_seed);

#ifdef _WIN32
    #define DASP_CUDA_EXPORT __declspec(dllexport)
#else
    #define DASP_CUDA_EXPORT __attribute__((visibility("default")))
#endif

DASP_CUDA_EXPORT void dspna512_cuda_encrypt_batch(
    const uint8_t *host_input,
    const uint8_t *host_key,
    uint8_t *host_out,
    size_t num_blocks
);

DASP_CUDA_EXPORT void dspna512_cuda_decrypt_batch(
    const uint8_t *host_input,
    const uint8_t *host_key,
    uint8_t *host_out,
    size_t num_blocks
);

#ifdef __cplusplus
}
#endif

#endif // DASP_CUDA_H
