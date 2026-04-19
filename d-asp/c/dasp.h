/**
 * @file dasp.h
 * @brief Internal D-ASP Library Interface.
 * 
 * Part of the D-ASP (ASP Cascade 16) Cryptographic Suite.
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 */

#ifndef DASP_H
#define DASP_H

#include <stddef.h>
#include <stdint.h>

/** 
 * @brief Fingerprint size for Identity-Bound Blending. 
 * Defaults to 512-bit (64 hex characters or 32 raw bytes).
 */
#define DASP_HWID_BYTES 64 

/**
 * @brief Identity-Bound Data Encapsulation (Encap).
 * Integrates NIST ML-KEM-1024 with the 16-round Cascade Gauntlet.
 *
 * @param out_ct   Output buffer for the combined ciphertext (KEM CT + Payload + MAC).
 *                 Size: CRYPTO_CIPHERTEXTBYTES + payload_len + 32.
 * @param pk       3072-byte ML-KEM-1024 Public Key.
 * @param hwid     64-byte Hardware ID fingerprint (optional, can be NULL).
 * @param payload  The data to be encapsulated.
 * @param payload_len Length of the payload in bytes.
 * @return 0 on success.
 */
int dasp_encapsulate_data(unsigned char *out_ct, 
                          const unsigned char *pk, 
                          const unsigned char *hwid, 
                          const unsigned char *payload, 
                          size_t payload_len);

/**
 * @brief Identity-Bound Data Decapsulation (Decap).
 * Validates integrity via HMAC before reversing the SPNA cascade.
 *
 * @param out_payload Buffer for recovered plaintext data.
 * @param sk          3168-byte ML-KEM-1024 Secret Key.
 * @param hwid        64-byte Hardware ID fingerprint (optional).
 * @param in_ct       Combined ciphertext buffer.
 * @param in_ct_len   Total length of the encapsulation.
 * @return 0 on success, negative on integrity or decryption failure.
 */
int dasp_decapsulate_data(unsigned char *out_payload,
                          const unsigned char *sk,
                          const unsigned char *hwid,
                          const unsigned char *in_ct,
                          size_t in_ct_len);

/* --- SPNA Engine Core Prototypes --- */

void spna_layer_substitution(unsigned char *state, size_t state_len, const unsigned char *k_word);
void spna_layer_permutation(unsigned char *state, size_t state_len);
void spna_layer_network(unsigned char *state, size_t state_len);
void spna_layer_algebraic(unsigned char *state, size_t state_len, const unsigned char *k_word);

/* --- Constant-Time GF(2^8) Math Prototypes --- */

uint8_t d_asp_gf_mult(uint8_t a, uint8_t b);

#endif // DASP_H
