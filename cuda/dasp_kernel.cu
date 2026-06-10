#include <stdio.h>
#include <stdint.h>
#include "dasp_cuda.h"

// d_round_keys_const is passed as an argument instead of __constant__

__device__ static inline uint32_t d_rotl32(uint32_t x, int n) {
    return __funnelshift_l(x, x, n);
}

__device__ static void d_chacha_quarter_round(uint32_t *x, int a, int b, int c, int d) {
    x[a] = x[a] + x[b]; x[d] ^= x[a]; x[d] = d_rotl32(x[d], 16);
    x[c] = x[c] + x[d]; x[b] ^= x[c]; x[b] = d_rotl32(x[b], 12);
    x[a] = x[a] + x[b]; x[d] ^= x[a]; x[d] = d_rotl32(x[d], 8);
    x[c] = x[c] + x[d]; x[b] ^= x[c]; x[b] = d_rotl32(x[b], 7);
}

__device__ static void d_chacha_block(uint32_t *state, uint32_t *out) {
    uint32_t x[16];
    #pragma unroll
    for(int i=0; i<16; i++) x[i] = state[i];
    #pragma unroll
    for (int i = 0; i < 10; i++) {
        d_chacha_quarter_round(x, 0, 4, 8, 12); d_chacha_quarter_round(x, 1, 5, 9, 13);
        d_chacha_quarter_round(x, 2, 6, 10, 14); d_chacha_quarter_round(x, 3, 7, 11, 15);
        d_chacha_quarter_round(x, 0, 5, 10, 15); d_chacha_quarter_round(x, 1, 6, 11, 12);
        d_chacha_quarter_round(x, 2, 7, 8, 13); d_chacha_quarter_round(x, 3, 4, 9, 14);
    }
    #pragma unroll
    for(int i=0; i<16; i++) out[i] = x[i] + state[i];
}

typedef struct {
    uint32_t state[16];
    uint32_t block[16];
    size_t block_idx;
} d_prng_t;

__device__ static void d_prng_init(d_prng_t *ctx, const uint8_t *seed_64) {
    for (int i = 0; i < 16; i++) {
        ctx->state[i] = seed_64[i*4] | (seed_64[i*4+1]<<8) | (seed_64[i*4+2]<<16) | (seed_64[i*4+3]<<24);
    }
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

__device__ static inline uint64_t d_rotl64(uint64_t x, int n) {
    return (x << n) | (x >> (64 - n));
}

// ---------------------------------------------------------
// PHASE 1: Device Key Derivation & Caching
// ---------------------------------------------------------

__global__ void init_keys_kernel(const uint8_t *prng_seed, uint64_t *out_keys) {
    if (threadIdx.x != 0 || blockIdx.x != 0) return;
    d_prng_t prng;
    d_prng_init(&prng, prng_seed);
    for (int i=0; i<128; i++) {
        uint32_t lo = d_prng_next(&prng);
        uint32_t hi = d_prng_next(&prng);
        out_keys[i] = ((uint64_t)hi << 32) | lo;
    }
}

// ---------------------------------------------------------
// PHASE 2: Parallel Block Encryption (CTR Mode)
// ---------------------------------------------------------

__global__ void __launch_bounds__(256, 4) dasp_ctr_kernel(uint8_t *payloads, size_t payload_len, const uint8_t *nonce_base, uint64_t block_offset, const uint64_t *d_round_keys_const, int dpa_triggered, const uint8_t *prng_seed) {
    size_t tid = blockIdx.x * blockDim.x + threadIdx.x;
    size_t byte_offset = tid * 64;
    if (byte_offset >= payload_len) return;
    
    // If DPA is triggered, wipe with chaotic PRNG instead of encrypting
    if (dpa_triggered) {
        d_prng_t prng;
        d_prng_init(&prng, prng_seed);
        for(int i=0; i<tid*2; i++) d_prng_next(&prng);
        
        uint32_t wipe_val = d_prng_next(&prng);
        uint8_t *wv = (uint8_t*)&wipe_val;
        
        size_t remaining = payload_len - byte_offset;
        size_t chunk = remaining > 64 ? 64 : remaining;
        for (size_t i = 0; i < chunk; i++) {
            payloads[byte_offset + i] ^= wv[i % 4];
        }
        return;
    }
    
    uint64_t global_block_idx = block_offset + tid;

    // Add global_block_idx to the nonce using Big-Endian addition across 64 bytes
    uint8_t n_bytes[64];
    for(int i=0; i<8; i++) {
        ((uint64_t*)n_bytes)[i] = ((const uint64_t*)nonce_base)[i];
    }
    
    uint64_t val = global_block_idx;
    for (int j = 63; j >= 0 && val > 0; j--) {
        uint32_t sum = n_bytes[j] + (uint32_t)(val & 0xFF);
        n_bytes[j] = sum & 0xFF;
        val = (val >> 8) + (sum >> 8);
    }

    uint64_t s[8];
    for(int i=0; i<8; i++) {
        s[i] = ((uint64_t*)n_bytes)[i];
    }

    /*
     * Permutation tables (matching AVX2 _mm256_permutevar8x32_epi32):
     *   _mm256_set_epi32 sets lanes in HIGH-to-LOW order, so
     *   set_epi32(3,2,1,0,7,6,5,4) means lane[0]=4, lane[1]=5, ..., lane[7]=3
     *
     * Blend masks (matching AVX2 _mm256_blend_epi32):
     *   0xF0 = bit 0..3 from A, bit 4..7 from B
     *   0xCC = bits 0,1,4,5 from A; bits 2,3,6,7 from B
     *   0xAA = even lanes (0,2,4,6) from A; odd lanes (1,3,5,7) from B
     */

#define DASP_ROUND_CUDA(r) do { \
    /* Step 1: Add round keys */ \
    s[0] += d_round_keys_const[(r)*8 + 0]; \
    s[1] += d_round_keys_const[(r)*8 + 1]; \
    s[2] += d_round_keys_const[(r)*8 + 2]; \
    s[3] += d_round_keys_const[(r)*8 + 3]; \
    s[4] += d_round_keys_const[(r)*8 + 4]; \
    s[5] += d_round_keys_const[(r)*8 + 5]; \
    s[6] += d_round_keys_const[(r)*8 + 6]; \
    s[7] += d_round_keys_const[(r)*8 + 7]; \
    \
    /* Step 2: XOR round constant */ \
    uint64_t rc_##r = 0x9E3779B97F4A7C15ULL + (r); \
    s[0] ^= rc_##r; s[1] ^= rc_##r; s[2] ^= rc_##r; s[3] ^= rc_##r; \
    s[4] ^= rc_##r; s[5] ^= rc_##r; s[6] ^= rc_##r; s[7] ^= rc_##r; \
    \
    /* Step 3: Permute to create 'swapped' */ \
    uint64_t sw_##r[8]; \
    if (((r) % 3) == 0) { \
        sw_##r[0]=s[4]; sw_##r[1]=s[5]; sw_##r[2]=s[6]; sw_##r[3]=s[7]; \
        sw_##r[4]=s[0]; sw_##r[5]=s[1]; sw_##r[6]=s[2]; sw_##r[7]=s[3]; \
    } else if (((r) % 3) == 1) { \
        sw_##r[0]=s[2]; sw_##r[1]=s[3]; sw_##r[2]=s[0]; sw_##r[3]=s[1]; \
        sw_##r[4]=s[6]; sw_##r[5]=s[7]; sw_##r[6]=s[4]; sw_##r[7]=s[5]; \
    } else { \
        sw_##r[0]=s[1]; sw_##r[1]=s[0]; sw_##r[2]=s[3]; sw_##r[3]=s[2]; \
        sw_##r[4]=s[5]; sw_##r[5]=s[4]; sw_##r[6]=s[7]; sw_##r[7]=s[6]; \
    } \
    \
    /* Step 4: A_new = state + swapped */ \
    uint64_t a_##r[8]; \
    a_##r[0]=s[0]+sw_##r[0]; a_##r[1]=s[1]+sw_##r[1]; \
    a_##r[2]=s[2]+sw_##r[2]; a_##r[3]=s[3]+sw_##r[3]; \
    a_##r[4]=s[4]+sw_##r[4]; a_##r[5]=s[5]+sw_##r[5]; \
    a_##r[6]=s[6]+sw_##r[6]; a_##r[7]=s[7]+sw_##r[7]; \
    \
    /* Step 5: B_new = state ^ A_new */ \
    uint64_t b_##r[8]; \
    b_##r[0]=s[0]^a_##r[0]; b_##r[1]=s[1]^a_##r[1]; \
    b_##r[2]=s[2]^a_##r[2]; b_##r[3]=s[3]^a_##r[3]; \
    b_##r[4]=s[4]^a_##r[4]; b_##r[5]=s[5]^a_##r[5]; \
    b_##r[6]=s[6]^a_##r[6]; b_##r[7]=s[7]^a_##r[7]; \
    \
    /* Step 6: Rotate B_new */ \
    int rot_##r = (((r) % 4) == 0) ? 32 : ((((r) % 4) == 1) ? 24 : ((((r) % 4) == 2) ? 16 : 14)); \
    b_##r[0]=d_rotl64(b_##r[0],rot_##r); b_##r[1]=d_rotl64(b_##r[1],rot_##r); \
    b_##r[2]=d_rotl64(b_##r[2],rot_##r); b_##r[3]=d_rotl64(b_##r[3],rot_##r); \
    b_##r[4]=d_rotl64(b_##r[4],rot_##r); b_##r[5]=d_rotl64(b_##r[5],rot_##r); \
    b_##r[6]=d_rotl64(b_##r[6],rot_##r); b_##r[7]=d_rotl64(b_##r[7],rot_##r); \
    \
    /* Step 7: Blend A_new and B_new back into state */ \
    if (((r) % 3) == 0) { \
        s[0]=a_##r[0]; s[1]=a_##r[1]; s[2]=a_##r[2]; s[3]=a_##r[3]; \
        s[4]=b_##r[4]; s[5]=b_##r[5]; s[6]=b_##r[6]; s[7]=b_##r[7]; \
    } else if (((r) % 3) == 1) { \
        s[0]=a_##r[0]; s[1]=a_##r[1]; s[2]=b_##r[2]; s[3]=b_##r[3]; \
        s[4]=a_##r[4]; s[5]=a_##r[5]; s[6]=b_##r[6]; s[7]=b_##r[7]; \
    } else { \
        s[0]=a_##r[0]; s[1]=b_##r[1]; s[2]=a_##r[2]; s[3]=b_##r[3]; \
        s[4]=a_##r[4]; s[5]=b_##r[5]; s[6]=a_##r[6]; s[7]=b_##r[7]; \
    } \
} while(0)

    DASP_ROUND_CUDA(0);  DASP_ROUND_CUDA(1);  DASP_ROUND_CUDA(2);  DASP_ROUND_CUDA(3);
    DASP_ROUND_CUDA(4);  DASP_ROUND_CUDA(5);  DASP_ROUND_CUDA(6);  DASP_ROUND_CUDA(7);
    DASP_ROUND_CUDA(8);  DASP_ROUND_CUDA(9);  DASP_ROUND_CUDA(10); DASP_ROUND_CUDA(11);
    DASP_ROUND_CUDA(12); DASP_ROUND_CUDA(13); DASP_ROUND_CUDA(14); DASP_ROUND_CUDA(15);
#undef DASP_ROUND_CUDA

    size_t remaining = payload_len - byte_offset;
    if (remaining >= 64) {
        // Use uint4 vector loads/stores for 128-bit coalesced memory transactions
        uint4 *p128 = (uint4*)(payloads + byte_offset);
        uint4 in0 = p128[0];
        uint4 in1 = p128[1];
        uint4 in2 = p128[2];
        uint4 in3 = p128[3];
        
        uint32_t *s32 = (uint32_t*)s;
        in0.x ^= s32[0]; in0.y ^= s32[1]; in0.z ^= s32[2]; in0.w ^= s32[3];
        in1.x ^= s32[4]; in1.y ^= s32[5]; in1.z ^= s32[6]; in1.w ^= s32[7];
        in2.x ^= s32[8]; in2.y ^= s32[9]; in2.z ^= s32[10]; in2.w ^= s32[11];
        in3.x ^= s32[12]; in3.y ^= s32[13]; in3.z ^= s32[14]; in3.w ^= s32[15];
        
        p128[0] = in0;
        p128[1] = in1;
        p128[2] = in2;
        p128[3] = in3;
    } else {
        uint8_t *t8 = (uint8_t*)s;
        for(size_t i=0; i<remaining; i++) payloads[byte_offset + i] ^= t8[i];
    }
}

uint64_t *g_round_keys_device = NULL;

extern "C" void dasp_cuda_init_keys(const uint8_t *d_keys_128) {
    const uint8_t *prng_seed = d_keys_128 + 64;
    
    if (!g_round_keys_device) {
        cudaMalloc(&g_round_keys_device, 128 * sizeof(uint64_t));
    }
    
    // Generate keys on GPU directly into device memory
    init_keys_kernel<<<1, 1>>>(prng_seed, g_round_keys_device);
    cudaDeviceSynchronize();
}

extern "C" void dasp_cuda_process_chunk(uint8_t *d_payload, size_t chunk_len, const uint8_t *d_nonce, uint64_t block_offset, cudaStream_t stream, int dpa_triggered, const uint8_t *prng_seed) {
    if (chunk_len == 0) return;

    size_t real_num_blocks = (chunk_len + 63) / 64;
    int threadsPerBlock = 256;
    int blocksPerGrid = (real_num_blocks + threadsPerBlock - 1) / threadsPerBlock;
    
    dasp_ctr_kernel<<<blocksPerGrid, threadsPerBlock, 0, stream>>>(d_payload, chunk_len, d_nonce, block_offset, g_round_keys_device, dpa_triggered, prng_seed);
    cudaError_t err = cudaGetLastError();
    if (err != cudaSuccess) {
        printf("CUDA ERROR in kernel: %s\n", cudaGetErrorString(err));
    }
}

extern "C" void dasp_cuda_init() {
    // No constant init needed anymore
}
