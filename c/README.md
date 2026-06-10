# D-SPNA-512 C Engine

The C implementation of D-SPNA-512 is built for maximum portability and raw performance. It supports MSVC, GCC, and Clang.

## Architecture
- **Dynamic CPU Dispatch**: Utilizes `__cpuid`, `_xgetbv()`, and OSXSAVE checks to dynamically route execution to `dasp_cascade_32_avx2`, or fallback to scalar execution.
- **ARM NEON**: When compiled on AArch64 hardware (Apple Silicon, Graviton), the system natively utilizes `<arm_neon.h>` to execute the cascade across dual 128-bit `uint32x4_t` registers, matching AVX2 throughput.
- **Hardware Wipes**: Physically zeroes `YMM` and `Q` registers prior to function return to mitigate Zenbleed.
- **Spectre Barriers**: Implements `_mm_lfence()` on x86 and `isb`/`csdb` on ARM at the MAC validation boundary.

## Build
Run `build.bat` on Windows (requires Visual Studio Developer Command Prompt) or use standard GCC commands.
