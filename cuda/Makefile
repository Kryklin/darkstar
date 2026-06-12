NVCC = nvcc
NVCC_FLAGS = -O3 -arch=sm_70 -I../c -Xcompiler -fPIC

# C sources from the reference implementation
C_DIR = ../c
C_SOURCES = $(C_DIR)/ml_kem.c $(C_DIR)/fips202.c $(C_DIR)/sha256.c $(C_DIR)/sha512.c $(C_DIR)/rng.c $(C_DIR)/poly.c $(C_DIR)/poly_sampling.c $(C_DIR)/gf_math.c

all: d-spna-512_cuda dspna512_cuda.so

d-spna-512_cuda: dasp_cli.cu dasp_kernel.cu $(C_SOURCES)
	$(NVCC) $(NVCC_FLAGS) $^ -o $@

dspna512_cuda.so: dasp_kernel.cu
	$(NVCC) $(NVCC_FLAGS) -shared $^ -o $@

clean:
	rm -f d-spna-512_cuda dspna512_cuda.so *.o
