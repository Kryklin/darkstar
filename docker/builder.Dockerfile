FROM alpine:latest
RUN apk add --no-cache gcc musl-dev
WORKDIR /usr/src/app
COPY c/ .
# Compile shared object
RUN gcc -shared -fPIC -o dasp_kem.so main.c spna_engine.c gf_math.c ml_kem.c fips202.c sha512.c sha256.c rng.c poly.c poly_sampling.c -I. -O3 -mavx2
