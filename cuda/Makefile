NVCC = nvcc
NVCC_FLAGS = -O3 -arch=sm_70 -I../c

# C sources from the reference implementation
C_DIR = ../c
C_SOURCES = $(C_DIR)/ml_kem.c $(C_DIR)/fips202.c $(C_DIR)/sha256.c $(C_DIR)/rng.c $(C_DIR)/poly.c $(C_DIR)/poly_sampling.c $(C_DIR)/aes.c $(C_DIR)/gf_math.c

all: d-asp_cuda

d-asp_cuda: dasp_cli.cu dasp_kernel.cu $(C_SOURCES)
	$(NVCC) $(NVCC_FLAGS) $^ -o $@

clean:
	rm -f d-asp_cuda *.o
