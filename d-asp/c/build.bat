@echo off
cl /Ox /W3 /std:c11 /Fe:dasp.exe main.c spna_engine.c ml_kem.c fips202.c sha256.c rng.c poly.c poly_sampling.c aes.c gf_math.c
if %errorlevel% neq 0 (
    echo Build failed.
    exit /b %errorlevel%
)
echo Build successful: dasp.exe
