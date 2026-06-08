FROM mcr.microsoft.com/dotnet/sdk:7.0-alpine
WORKDIR /app
COPY out-wrappers/csharp_wrapper.cs .
COPY --from=dasp-builder /usr/src/app/dasp_kem.so .
# For WASM wrappers
COPY wasm/dasp_crypto.wasm .
CMD sh -c "dotnet new console -n wrapper && cp csharp_wrapper.cs wrapper/Program.cs && cd wrapper && dotnet run"
