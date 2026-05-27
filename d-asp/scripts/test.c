#include <immintrin.h>
#include <stdio.h>
int main() {
    __m256i v = _mm256_setr_epi32(10, 20, 30, 40, 50, 60, 70, 80);
    __m256i mask = _mm256_set_epi32(0, 7, 6, 5, 4, 3, 2, 1);
    v = _mm256_permutevar8x32_epi32(v, mask);
    int out[8];
    _mm256_storeu_si256((__m256i*)out, v);
    for(int i=0; i<8; i++) printf("%d ", out[i]);
    return 0;
}
