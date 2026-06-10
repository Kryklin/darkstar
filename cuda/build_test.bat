@echo off
set C_DIR=..\c
set VS_VARS=X:\vs\cache\VC\Auxiliary\Build\vcvarsall.bat

if not exist "%VS_VARS%" (
    echo MSVC environment script not found at %VS_VARS%
    exit /b 1
)

echo Initializing MSVC environment (Version 14.29)...
call "%VS_VARS%" x64 -vcvars_ver=14.29

set NVCC_FLAGS=-O3 -arch=sm_70 -I%C_DIR% -allow-unsupported-compiler

echo Building D-ASP CUDA Test Suite...
nvcc %NVCC_FLAGS% test.cu dasp_kernel.cu %C_DIR%\sha256.c -o d-spna-512_test.exe

if %errorlevel% neq 0 (
    echo Build failed.
    exit /b %errorlevel%
)
echo Build successful: d-spna-512_test.exe
