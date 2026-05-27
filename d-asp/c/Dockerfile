# Build stage
FROM alpine:latest as builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /usr/src/app
COPY . .
# The C engine uses several files for the cryptographic suite.
RUN gcc -o darkstar-crypt-c main.c spna_engine.c gf_math.c ml_kem.c fips202.c sha512.c sha256.c aes.c rng.c poly.c poly_sampling.c -I. -O3

# Runtime stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /usr/src/app/darkstar-crypt-c ./darkstar-crypt-c
ENTRYPOINT ["./darkstar-crypt-c"]
