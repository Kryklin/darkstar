#include <stdio.h>
#include <stdint.h>
#include "dasp_cuda.h"

__constant__ uint32_t d_round_keys_const[128];

__device__ static inline uint32_t d_rotl32(uint32_t x, int n) {
    return (x << n) | (x >> (32 - n));
}

__device__ static void d_chacha_quarter_round(uint32_t *x, int a, int b, int c, int d) {
    x[a] = x[a] + x[b]; x[d] ^= x[a]; x[d] = d_rotl32(x[d], 16);
    x[c] = x[c] + x[d]; x[b] ^= x[c]; x[b] = d_rotl32(x[b], 12);
    x[a] = x[a] + x[b]; x[d] ^= x[a]; x[d] = d_rotl32(x[d], 8);
    x[c] = x[c] + x[d]; x[b] ^= x[c]; x[b] = d_rotl32(x[b], 7);
}

__device__ static void d_chacha_block(uint32_t *state, uint32_t *out) {
    uint32_t x[16];
    for(int i=0; i<16; i++) x[i] = state[i];
    for (int i = 0; i < 10; i++) {
        d_chacha_quarter_round(x, 0, 4, 8, 12); d_chacha_quarter_round(x, 1, 5, 9, 13);
        d_chacha_quarter_round(x, 2, 6, 10, 14); d_chacha_quarter_round(x, 3, 7, 11, 15);
        d_chacha_quarter_round(x, 0, 5, 10, 15); d_chacha_quarter_round(x, 1, 6, 11, 12);
        d_chacha_quarter_round(x, 2, 7, 8, 13); d_chacha_quarter_round(x, 3, 4, 9, 14);
    }
    for(int i=0; i<16; i++) out[i] = x[i] + state[i];
}

typedef struct {
    uint32_t state[16];
    uint32_t block[16];
    size_t block_idx;
} d_prng_t;

__device__ static void d_prng_init(d_prng_t *ctx, const uint8_t *seed_64) {
    ctx->state[0] = 0x61707865;
    ctx->state[1] = 0x3320646e;
    ctx->state[2] = 0x79622d32;
    ctx->state[3] = 0x6b206574;
    for (int i = 0; i < 8; i++) {
        ctx->state[4+i] = seed_64[i*4] | (seed_64[i*4+1]<<8) | (seed_64[i*4+2]<<16) | (seed_64[i*4+3]<<24);
    }
    ctx->state[12] = 0; ctx->state[13] = 0; ctx->state[14] = 0; ctx->state[15] = 0;
    d_chacha_block(ctx->state, ctx->block);
    ctx->block_idx = 0;
}

__device__ static uint32_t d_prng_next(d_prng_t *ctx) {
    if (ctx->block_idx >= 16) {
        ctx->state[12]++;
        d_chacha_block(ctx->state, ctx->block);
        ctx->block_idx = 0;
    }
    return ctx->block[ctx->block_idx++];
}

// ---------------------------------------------------------
// PHASE 1: Device Key Derivation & Caching
// ---------------------------------------------------------

__global__ void init_keys_kernel(const uint8_t *prng_seed, uint32_t *out_keys) {
    if (threadIdx.x != 0 || blockIdx.x != 0) return;
    d_prng_t prng;
    d_prng_init(&prng, prng_seed);
    for (int i=0; i<128; i++) {
        out_keys[i] = d_prng_next(&prng);
    }
}

// ---------------------------------------------------------
// PHASE 2: Parallel Block Encryption (CTR Mode)
// ---------------------------------------------------------

__global__ void __launch_bounds__(256, 4) dasp_ctr_kernel(uint8_t *payloads, size_t payload_len, const uint8_t *nonce_base, uint64_t block_offset) {
    size_t tid = blockIdx.x * blockDim.x + threadIdx.x;
    size_t byte_offset = tid * 32;
    if (byte_offset >= payload_len) return;
    
    uint64_t global_block_idx = block_offset + tid;

    // Load nonce (chain_state)
    // Nonce is 32 bytes = two uint4s. 
    // We do not assume it is aligned to 16 bytes for uint4 loading, so we load as uint32
    uint32_t n[8];
    for(int i=0; i<8; i++) {
        n[i] = ((uint32_t*)nonce_base)[i];
    }
    
    // Add global_block_idx to the nonce. Little endian addition on the first 32 bits
    uint64_t n_low = (uint64_t)n[0] + global_block_idx;
    n[0] = (uint32_t)n_low;
    // Simple carry propagation (sufficient for reasonable payloads)
    if (n_low > 0xFFFFFFFF) {
        uint64_t n1 = (uint64_t)n[1] + (n_low >> 32);
        n[1] = (uint32_t)n1;
    }

    uint4 s0, s1;
    s0.x = n[0]; s0.y = n[1]; s0.z = n[2]; s0.w = n[3];
    s1.x = n[4]; s1.y = n[5]; s1.z = n[6]; s1.w = n[7];

#define DASP_ROUND_CUDA(i) do { \
    s0.x += d_round_keys_const[(i)*8 + 0]; \
    s0.y += d_round_keys_const[(i)*8 + 1]; \
    s0.z += d_round_keys_const[(i)*8 + 2]; \
    s0.w += d_round_keys_const[(i)*8 + 3]; \
    s1.x += d_round_keys_const[(i)*8 + 4]; \
    s1.y += d_round_keys_const[(i)*8 + 5]; \
    s1.z += d_round_keys_const[(i)*8 + 6]; \
    s1.w += d_round_keys_const[(i)*8 + 7]; \
    \
    uint32_t rc = 0x9E3779B9 + (i); \
    s0.x ^= rc; s0.y ^= rc; s0.z ^= rc; s0.w ^= rc; \
    s1.x ^= rc; s1.y ^= rc; s1.z ^= rc; s1.w ^= rc; \
    \
    int rot = (((i) % 4) == 0) ? 16 : ((((i) % 4) == 1) ? 12 : ((((i) % 4) == 2) ? 8 : 7)); \
    if (((i) % 3) == 0) { \
        s0.x += s1.x; s1.x ^= s0.x; s1.x = __funnelshift_l(s1.x, s1.x, rot); \
        s0.y += s1.y; s1.y ^= s0.y; s1.y = __funnelshift_l(s1.y, s1.y, rot); \
        s0.z += s1.z; s1.z ^= s0.z; s1.z = __funnelshift_l(s1.z, s1.z, rot); \
        s0.w += s1.w; s1.w ^= s0.w; s1.w = __funnelshift_l(s1.w, s1.w, rot); \
    } else if (((i) % 3) == 1) { \
        s0.x += s0.z; s0.z ^= s0.x; s0.z = __funnelshift_l(s0.z, s0.z, rot); \
        s0.y += s0.w; s0.w ^= s0.y; s0.w = __funnelshift_l(s0.w, s0.w, rot); \
        s1.x += s1.z; s1.z ^= s1.x; s1.z = __funnelshift_l(s1.z, s1.z, rot); \
        s1.y += s1.w; s1.w ^= s1.y; s1.w = __funnelshift_l(s1.w, s1.w, rot); \
    } else { \
        s0.x += s0.y; s0.y ^= s0.x; s0.y = __funnelshift_l(s0.y, s0.y, rot); \
        s0.z += s0.w; s0.w ^= s0.z; s0.w = __funnelshift_l(s0.w, s0.w, rot); \
        s1.x += s1.y; s1.y ^= s1.x; s1.y = __funnelshift_l(s1.y, s1.y, rot); \
        s1.z += s1.w; s1.w ^= s1.z; s1.w = __funnelshift_l(s1.w, s1.w, rot); \
    } \
} while(0)

    DASP_ROUND_CUDA(0);  DASP_ROUND_CUDA(1);  DASP_ROUND_CUDA(2);  DASP_ROUND_CUDA(3);
    DASP_ROUND_CUDA(4);  DASP_ROUND_CUDA(5);  DASP_ROUND_CUDA(6);  DASP_ROUND_CUDA(7);
    DASP_ROUND_CUDA(8);  DASP_ROUND_CUDA(9);  DASP_ROUND_CUDA(10); DASP_ROUND_CUDA(11);
    DASP_ROUND_CUDA(12); DASP_ROUND_CUDA(13); DASP_ROUND_CUDA(14); DASP_ROUND_CUDA(15);
#undef DASP_ROUND_CUDA

    size_t remaining = payload_len - byte_offset;
    if (remaining >= 32) {
        // Can read/write 32 bytes safely
        // Use uint4 vector loads/stores for 128-bit coalesced memory transactions
        uint4 *p128 = (uint4*)(payloads + byte_offset);
        uint4 in0 = p128[0];
        uint4 in1 = p128[1];
        in0.x ^= s0.x; in0.y ^= s0.y; in0.z ^= s0.z; in0.w ^= s0.w;
        in1.x ^= s1.x; in1.y ^= s1.y; in1.z ^= s1.z; in1.w ^= s1.w;
        p128[0] = in0;
        p128[1] = in1;
    } else {
        uint32_t temp[8];
        temp[0] = s0.x; temp[1] = s0.y; temp[2] = s0.z; temp[3] = s0.w;
        temp[4] = s1.x; temp[5] = s1.y; temp[6] = s1.z; temp[7] = s1.w;
        uint8_t *t8 = (uint8_t*)temp;
        for(size_t i=0; i<remaining; i++) payloads[byte_offset + i] ^= t8[i];
    }
}

extern "C" void dasp_cuda_init_keys(const uint8_t *d_keys_128) {
    const uint8_t *prng_seed = d_keys_128 + 64;
    
    // Allocate temporary device buffer for keys
    uint32_t *d_tmp_keys;
    cudaMalloc(&d_tmp_keys, 128 * sizeof(uint32_t));
    
    // Generate keys on GPU
    init_keys_kernel<<<1, 1>>>(prng_seed, d_tmp_keys);
    cudaDeviceSynchronize();
    
    // Copy keys back to Host
    uint32_t h_tmp_keys[128];
    cudaMemcpy(h_tmp_keys, d_tmp_keys, 128 * sizeof(uint32_t), cudaMemcpyDeviceToHost);
    cudaFree(d_tmp_keys);
    
    // Copy keys to __constant__ cache
    cudaMemcpyToSymbol(d_round_keys_const, h_tmp_keys, 128 * sizeof(uint32_t));
}

extern "C" void dasp_cuda_process_chunk(uint8_t *d_payload, size_t chunk_len, const uint8_t *d_nonce, uint64_t block_offset, cudaStream_t stream) {
    if (chunk_len == 0) return;

    size_t real_num_blocks = (chunk_len + 31) / 32;
    int threadsPerBlock = 256;
    int blocksPerGrid = (real_num_blocks + threadsPerBlock - 1) / threadsPerBlock;
    
    dasp_ctr_kernel<<<blocksPerGrid, threadsPerBlock, 0, stream>>>(d_payload, chunk_len, d_nonce, block_offset);
}

extern "C" void dasp_cuda_init() {
    // No constant init needed anymore
}
