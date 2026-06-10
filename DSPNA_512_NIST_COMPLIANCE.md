# NIST Compliance (D-SPNA-512)

D-SPNA-512 was built from the ground up to adhere to modern FIPS and NIST PQC (Post-Quantum Cryptography) standards.

## FIPS 203 (ML-KEM)
The core encapsulation logic strictly utilizes **ML-KEM-1024**, matching the final FIPS 203 standard for quantum-resistant key establishment. 

## FIPS 202 (SHA-3) & FIPS 180-4 (SHA-2)
- **HKDF**: Key expansion relies on standard HKDF (RFC 5869) utilizing HMAC-SHA256.
- **MAC**: Payload integrity is authenticated via HMAC-SHA256.
- **DRBG**: The dynamic reseeding engine utilizes system-provided secure random streams (`/dev/urandom` / `BCryptGenRandom`) in compliance with SP 800-90A.

D-SPNA-512 represents a highly opinionated, military-grade envelope that surrounds compliant NIST primitives with extreme hardware-level threat mitigations.
