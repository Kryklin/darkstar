FROM nvidia/cuda:11.8.0-devel-ubuntu22.04

WORKDIR /app

# The build context is set to `d-asp/` in docker-compose.yml
# Copy the CUDA source code
COPY cuda/ ./cuda/

# The CUDA engine builds against the C API headers and implementations
COPY c/ ./c/

# Compile the CUDA engine
RUN nvcc -O3 \
    cuda/dasp_cli.cu \
    cuda/dasp_kernel.cu \
    c/ml_kem.c \
    c/fips202.c \
    c/sha512.c \
    c/sha256.c \
    c/aes.c \
    c/rng.c \
    c/poly.c \
    c/poly_sampling.c \
    -I./c -I./cuda \
    -o darkstar-crypt-cuda

ENTRYPOINT ["./darkstar-crypt-cuda"]
