#ifndef _DASP_SHA512_H_
#define _DASP_SHA512_H_

#include <stdint.h>
#include <stddef.h>

void crypto_sha512(const uint8_t *data, size_t len, uint8_t *out);
void crypto_hmac_sha512(const uint8_t *key, size_t key_len, const uint8_t *data, size_t data_len, uint8_t *out);

#endif
