# Stage 1: Build the C shared library
FROM alpine:latest AS c-builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /app/c
COPY c/ ./
RUN gcc -shared -fPIC -o libdasp_kem.so spna_engine.c gf_math.c ml_kem.c fips202.c sha512.c sha256.c aes.c rng.c poly.c poly_sampling.c -I. -O3 -mavx2

# Stage 2: Build the C# project
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS csharp-builder
WORKDIR /app
COPY csharp/ ./csharp/
COPY --from=c-builder /app/c/libdasp_kem.so ./c/
WORKDIR /app/csharp
RUN dotnet build -c Release

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/runtime:8.0-alpine
WORKDIR /app
COPY --from=csharp-builder /app/csharp/bin/Release/net8.0/ ./
COPY --from=c-builder /app/c/libdasp_kem.so ./
ENTRYPOINT ["dotnet", "d-asp_csharp.dll"]
