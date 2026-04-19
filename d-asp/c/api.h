/**
 * @file api.h
 * @brief Public API definitions * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * Repository: <https://github.com/Kryklin/darkstar>
 * 
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 * 
 * See <http://creativecommons.org/publicdomain/zero/1.0/>
 */

#ifndef API_H
#define API_H

#include <stddef.h>

/** @brief Algorithm Name in NIST format */
#define CRYPTO_ALGNAME "ASP_Cascade_16_D_ASP"

// ML-KEM-1024 derived sizing (FIPS 203 parameters)
#define CRYPTO_SECRETKEYBYTES  3168
#define CRYPTO_PUBLICKEYBYTES  1568
#define CRYPTO_BYTES           32   // Final blended shared secret (K_root)
#define CRYPTO_CIPHERTEXTBYTES 1568

/**
 * @brief Standard NIST PQC Keypair Generation.
 * @param pk Output 1568-byte Public Key.
 * @param sk Output 3168-byte Secret Key.
 * @return 0 on success.
 */
int crypto_kem_keypair(unsigned char *pk, unsigned char *sk);

/**
 * @brief Standard NIST PQC Encapsulation.
 * Produces a 1568-byte ciphertext and a 32-byte shared secret.
 */
int crypto_kem_enc(unsigned char *ct, unsigned char *ss, const unsigned char *pk);

/**
 * @brief Standard NIST PQC Decapsulation.
 * Recovers the 32-byte shared secret from the ciphertext.
 */
int crypto_kem_dec(unsigned char *ss, const unsigned char *ct, const unsigned char *sk);

#endif // API_H
