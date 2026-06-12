@echo off
set VS_VARS=X:\vs\cache\VC\Auxiliary\Build\vcvarsall.bat
if not exist "%VS_VARS%" (
    echo MSVC environment script not found at %VS_VARS%
    exit /b 1
)
call "%VS_VARS%" x64 -vcvars_ver=14.29
rc.exe icon.rc
if %errorlevel% neq 0 (
    echo Resource compilation failed.
    exit /b %errorlevel%
)

echo Compiling object files...
cl /c /O2 /GL /W3 /std:c11 spna_engine.c ml_kem.c fips202.c sha512.c sha256.c rng.c poly.c poly_sampling.c gf_math.c
if %errorlevel% neq 0 (
    echo Object compilation failed.
    exit /b %errorlevel%
)

echo Building CLI Executable...
cl /O2 /GL /W3 /std:c11 /Fe:d-spna-512.exe main.c spna_engine.obj ml_kem.obj fips202.obj sha512.obj sha256.obj rng.obj poly.obj poly_sampling.obj gf_math.obj icon.res
if %errorlevel% neq 0 (
    echo Build failed.
    exit /b %errorlevel%
)

echo Building DLL for FFI Supervisor...
cl /LD /O2 /GL /W3 /std:c11 /Fe:dspna512.dll spna_engine.obj ml_kem.obj fips202.obj sha512.obj sha256.obj rng.obj poly.obj poly_sampling.obj gf_math.obj
if %errorlevel% neq 0 (
    echo DLL Build failed.
    exit /b %errorlevel%
)

echo Building DLL for C# Interoperability...
cl /LD /O2 /GL /W3 /std:c11 /Fe:d-spna-512_kem.dll ml_kem.obj fips202.obj sha512.obj sha256.obj rng.obj poly.obj poly_sampling.obj gf_math.obj
if %errorlevel% neq 0 (
    echo KEM DLL Build failed.
    exit /b %errorlevel%
)

echo Build successful: dasp.exe, dspna512.dll, and dasp_kem.dll
