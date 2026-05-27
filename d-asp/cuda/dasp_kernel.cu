#include <stdio.h>
#include <stdint.h>
#include "dasp_cuda.h"

/* --- Constant Memory for S-Boxes and Matrices --- */
__constant__ unsigned char d_SBOX[256];
__constant__ unsigned char d_INV_SBOX[256];
__constant__ uint8_t d_MDS_MATRIX[4][4];
__constant__ uint8_t d_INV_MDS_MATRIX[4][4];

/* --- Device Utility Functions --- */

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

__device__ static uint8_t d_gf_mult(uint8_t a, uint8_t b) {
    uint8_t p = 0;
    for (int i = 0; i < 8; i++) {
        p ^= (-(b & 1)) & a;
        uint8_t mask = -(a >> 7);
        a = (a << 1) ^ (0x1B & mask);
        b >>= 1;
    }
    return p;
}

/* --- Round Transformations (Device Functions) --- */

__device__ static void dt_sbox(uint8_t *data, size_t len, int fw) {
    for(size_t i=0; i<len; i++) {
        data[i] = fw ? d_SBOX[data[i]] : d_INV_SBOX[data[i]];
    }
}

__device__ static void dt_modmult(uint8_t *data, size_t len, int fw) {
    for(size_t i=0; i<len; i++) {
        data[i] = (uint8_t)(((uint16_t)data[i] * (fw ? 167 : 23)) & 0xFF);
    }
}

__device__ static void dt_pbox_bitrev(uint8_t *data, size_t len) {
    for(size_t i=0; i<len; i++) {
        uint8_t b = data[i];
        b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4);
        b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2);
        b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1);
        data[i] = b;
    }
    // Reverse the entire array (simple swap loop)
    for(size_t i=0; i < len/2; i++) {
        uint8_t tmp = data[i];
        data[i] = data[len-1-i];
        data[len-1-i] = tmp;
    }
}

__device__ static void dt_cyclicrot(uint8_t *data, size_t len, int fw) {
    for(size_t i=0; i<len; i++) {
        uint8_t b = data[i];
        if(fw) data[i] = (b >> 3) | (b << 5);
        else data[i] = (b << 3) | (b >> 5);
    }
}

__device__ static void dt_keyedxor(uint8_t *data, size_t len, const uint8_t *seed, int fw) {
    for(size_t i=0; i<len; i++) data[i] ^= seed[i % 32];
}

__device__ static void dt_feistel(uint8_t *data, size_t len, const uint8_t *seed, int fw) {
    size_t half = len / 2;
    if(half == 0) return;
    for(size_t i=0; i<half; i++) {
        uint8_t f = (uint8_t)((data[half + i] + seed[i % 32]) & 0xFF);
        data[i] ^= f;
    }
}

__device__ static void dt_modadd(uint8_t *data, size_t len, const uint8_t *seed, int fw) {
    for(size_t i=0; i<len; i++) {
        if(fw) data[i] = (uint8_t)((data[i] + seed[i % 32]) & 0xFF);
        else data[i] = (uint8_t)((data[i] - seed[i % 32]) & 0xFF);
    }
}

__device__ static void dt_matrixhill(uint8_t *data, size_t len, int fw) {
    if(len == 0) return;
    if(fw) {
        for(size_t i=1; i<len; i++) data[i] = (uint8_t)((data[i] + data[i-1]) & 0xFF);
    } else {
        for(size_t i=len-1; i > 0; i--) data[i] = (uint8_t)((data[i] - data[i-1]) & 0xFF);
    }
}

__device__ static void dt_gfmult(uint8_t *data, size_t len, int fw) {
    uint8_t factor = fw ? 0x02 : 0x8D;
    for(size_t i=0; i<len; i++) data[i] = d_gf_mult(data[i], factor);
}

__device__ static void dt_bitflip(uint8_t *data, size_t len, const uint8_t *seed) {
    for(size_t i=0; i<len; i++) {
        uint8_t mask = seed[i % 32];
        data[i] ^= ((mask & 0xAA) | (~mask & 0x55));
    }
}

__device__ static void dt_columnar(uint8_t *data, size_t len, int fw) {
    uint8_t out[1024]; // Assume max payload 1024 for this engine
    if(len > 1024) return;
    int cols = 8;
    size_t idx = 0;
    if(fw) {
        for(int c=0; c<cols; c++) {
            for(size_t i=c; i<len; i+=cols) out[idx++] = data[i];
        }
    } else {
        for(int c=0; c<cols; c++) {
            for(size_t i=c; i<len; i+=cols) out[i] = data[idx++];
        }
    }
    for(size_t i=0; i<len; i++) data[i] = out[i];
}

__device__ static void dt_recxor(uint8_t *data, size_t len, int fw) {
    if(len == 0) return;
    if(fw) {
        for(size_t i=1; i<len; i++) data[i] ^= data[i-1];
    } else {
        for(size_t i=len-1; i > 0; i--) data[i] ^= data[i-1];
    }
}

__device__ static void dt_mds(uint8_t *data, size_t len, int fw) {
    if (len < 4) return;
    for(size_t i=0; i<=len-4; i+=4) {
        uint8_t temp[4];
        for(int r=0; r<4; r++) {
            temp[r] = 0;
            for(int c=0; c<4; c++) {
                uint8_t factor = fw ? d_MDS_MATRIX[r][c] : d_INV_MDS_MATRIX[r][c];
                temp[r] ^= d_gf_mult(data[i+c], factor);
            }
        }
        for(int r=0; r<4; r++) data[i+r] = temp[r];
    }
}

/* --- MAIN KERNEL --- */

__global__ void dasp_spna_kernel(uint8_t *payloads, size_t payload_len, const uint8_t *keys_128, int is_forward) {
    size_t tid = blockIdx.x * blockDim.x + threadIdx.x;
    // Current Block Strategy: Each thread processes the ENTIRE payload (Wide-Block approach)
    if (tid > 0) return; 

    uint8_t *local_data = payloads;
    size_t len = payload_len;

    const uint8_t *func_key = keys_128;
    const uint8_t *prng_seed = keys_128 + 64;

    d_prng_t prng;
    d_prng_init(&prng, prng_seed);

    int groupS[] = {0, 1, 5};
    int groupP[] = {2, 3, 10};
    int groupN[] = {12, 12, 11};
    int groupA[] = {4, 6, 9};

    uint8_t paths[16][4];
    for(int r=0; r<16; r++) {
        paths[r][0] = (r % 4 == 0) ? 0 : ((r % 4 == 2) ? 1 : groupS[d_prng_next(&prng) % 3]);
        paths[r][1] = groupP[d_prng_next(&prng) % 3];
        paths[r][2] = groupN[d_prng_next(&prng) % 3];
        paths[r][3] = groupA[d_prng_next(&prng) % 3];
    }

    if(is_forward) {
        for(int r=0; r<16; r++) {
            // S-Layer
            int s = paths[r][0];
            if(s==0) dt_sbox(local_data, len, 1);
            else if(s==1) dt_modmult(local_data, len, 1);
            else if(s==5) dt_feistel(local_data, len, func_key, 1);
            
            // P-Layer
            int p = paths[r][1];
            if(p==2) dt_pbox_bitrev(local_data, len);
            else if(p==3) dt_cyclicrot(local_data, len, 1);
            else if(p==10) dt_columnar(local_data, len, 1);
            
            // N-Layer
            int n = paths[r][2];
            if(n==11) dt_recxor(local_data, len, 1);
            else if(n==12) dt_mds(local_data, len, 1);

            // A-Layer
            int a = paths[r][3];
            if(a==4) dt_keyedxor(local_data, len, func_key, 1);
            else if(a==6) dt_modadd(local_data, len, func_key, 1);
            else if(a==9) dt_bitflip(local_data, len, func_key);
        }
    } else {
        for(int r=15; r>=0; r--) {
            // Inverse A-Layer
            int a = paths[r][3];
            if(a==4) dt_keyedxor(local_data, len, func_key, 0);
            else if(a==6) dt_modadd(local_data, len, func_key, 0);
            else if(a==9) dt_bitflip(local_data, len, func_key);

            // Inverse N-Layer
            int n = paths[r][2];
            if(n==11) dt_recxor(local_data, len, 0);
            else if(n==12) dt_mds(local_data, len, 0);

            // Inverse P-Layer
            int p = paths[r][1];
            if(p==2) dt_pbox_bitrev(local_data, len);
            else if(p==3) dt_cyclicrot(local_data, len, 0);
            else if(p==10) dt_columnar(local_data, len, 0);

            // Inverse S-Layer
            int s = paths[r][0];
            if(s==0) dt_sbox(local_data, len, 0);
            else if(s==1) dt_modmult(local_data, len, 0);
            else if(s==5) dt_feistel(local_data, len, func_key, 0);
        }
    }
}

/* --- Host Wrapper --- */

extern "C" void dasp_cuda_process_blocks(uint8_t *d_payload, size_t payload_len, const uint8_t *d_keys_128, const uint8_t *d_hwid, size_t num_blocks, int is_forward) {
    // Current simplified implementation: 1 thread processes the whole payload buffer
    dasp_spna_kernel<<<1, 1>>>(d_payload, payload_len, d_keys_128, is_forward);
    cudaDeviceSynchronize();
}

/* --- Initialization --- */

extern "C" void dasp_cuda_init() {
    static const uint8_t MDS_REF[4][4] = {
        {0x02, 0x03, 0x01, 0x01},
        {0x01, 0x02, 0x03, 0x01},
        {0x01, 0x01, 0x02, 0x03},
        {0x03, 0x01, 0x01, 0x02}
    };
    static const uint8_t INV_MDS_REF[4][4] = {
        {0x0E, 0x0B, 0x0D, 0x09},
        {0x09, 0x0E, 0x0B, 0x0D},
        {0x0D, 0x09, 0x0E, 0x0B},
        {0x0B, 0x0D, 0x09, 0x0E}
    };
    static const unsigned char SBOX_REF[256] = {
        0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
        0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
        0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
        0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
        0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
        0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
        0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
        0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
        0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
        0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
        0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
        0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
        0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
        0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
        0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
        0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    };
    static unsigned char INV_SBOX_REF[256];
    for(int i=0; i<256; i++) INV_SBOX_REF[SBOX_REF[i]] = i;

    cudaMemcpyToSymbol(d_SBOX, SBOX_REF, 256);
    cudaMemcpyToSymbol(d_INV_SBOX, INV_SBOX_REF, 256);
    cudaMemcpyToSymbol(d_MDS_MATRIX, MDS_REF, 16);
    cudaMemcpyToSymbol(d_INV_MDS_MATRIX, INV_MDS_REF, 16);
}
