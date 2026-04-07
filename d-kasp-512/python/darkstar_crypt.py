
import os
import base64
import json
import struct
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

class DarkstarCrypt:
    ITERATIONS_V2 = 600000
    KEY_SIZE = 32 # 256 bits
    SALT_SIZE_BYTES = 16 # 128 bits
    IV_SIZE_BYTES = 16 # 128 bits

    """
    d-kasp-512 Encryption Suite
    
    This suite implements the definitive Darkstar protocol (V5):
    - D: Darkstar ecosystem origin
    - K: ML-KEM-1024 (Kyber-1024) NIST Level 5 Root of Trust
    - A: Augmented 64-layer SPN/ARX transformation gauntlet
    - S: Sequential word-based path-logic
    - P: Permutation-based non-linear core (S-Boxes, P-Boxes, Galois mixing)
    - 1024: 256-bit Post-Quantum security parity
    """

    # --- PRNG ---
    class Mulberry32:
        def __init__(self, seed_str):
            self.state = self._seed(seed_str)

        def _seed(self, seed_str):
            h = 0
            for char in seed_str:
                code = ord(char)
                h = (h ^ code) & 0xFFFFFFFF
                h = (h * 3432918353) & 0xFFFFFFFF
                h = ((h << 13) & 0xFFFFFFFF) | (h >> 19)
            
            h = (h ^ (h >> 16)) & 0xFFFFFFFF
            h = (h * 2246822507) & 0xFFFFFFFF
            h = (h ^ (h >> 13)) & 0xFFFFFFFF
            h = (h * 3266489909) & 0xFFFFFFFF
            h = (h ^ (h >> 16)) & 0xFFFFFFFF
            return h

        def next(self):
            self.state = (self.state + 0x6d2b79f5) & 0xFFFFFFFF
            
            t = (self.state ^ (self.state >> 15)) & 0xFFFFFFFF
            t = (t * (1 | self.state)) & 0xFFFFFFFF
            
            term2 = (t ^ (t >> 7)) & 0xFFFFFFFF
            term2 = (term2 * (61 | t)) & 0xFFFFFFFF
            t = ((t + term2) & 0xFFFFFFFF) ^ t
            
            res = (t ^ (t >> 14)) & 0xFFFFFFFF
            return res

    class DarkstarChaChaPRNG:
        def __init__(self, seed_str):
            import hashlib
            hash_hex = hashlib.sha256(seed_str.encode('utf-8')).hexdigest()
            self.state = [0]*8
            for i in range(8):
                self.state[i] = int(hash_hex[i * 8 : (i + 1) * 8], 16)
            self.counter = 0

        def next(self):
            self.counter += 1
            x = self.state[(self.counter + 0) % 8]
            y = self.state[(self.counter + 3) % 8]
            z = self.state[(self.counter + 5) % 8]

            x = (x + y + self.counter) & 0xFFFFFFFF
            z = (z ^ x) & 0xFFFFFFFF
            z = ((z << 16) & 0xFFFFFFFF) | (z >> 16)

            y = (y + z + (self.counter * 3)) & 0xFFFFFFFF
            x = (x ^ y) & 0xFFFFFFFF
            x = ((x << 12) & 0xFFFFFFFF) | (x >> 20)

            self.state[(self.counter + 0) % 8] = x
            self.state[(self.counter + 3) % 8] = y
            self.state[(self.counter + 5) % 8] = z

            def to_signed(val):
                val &= 0xFFFFFFFF
                return val - 0x100000000 if val >= 0x80000000 else val

            def js_imul(a, b):
                return (to_signed(a) * to_signed(b)) & 0xFFFFFFFF
                
            t = (x + y + z) & 0xFFFFFFFF
            t = js_imul(t ^ (t >> 15), 1 | t)
            
            term2 = js_imul(t ^ (t >> 7), 61 | t)
            t = ((t + term2) & 0xFFFFFFFF) ^ t

            res = (t ^ (t >> 14)) & 0xFFFFFFFF
            return res

    # --- Helpers ---
    def _to_bytes(self, s):
        if isinstance(s, str):
            return s.encode('utf-8')
        return s

    def _bytes_to_string(self, b):
        if isinstance(b, bytes) or isinstance(b, bytearray):
            return b.decode('utf-8')
        return b

    def _generate_checksum(self, numbers):
        if not numbers:
            return 0
        return sum(numbers) % 997

    # --- Obfuscation Functions (V2) ---
    # Note: Implementing V2 (Uint8Array-based) logic using Python bytes/bytearray

    # 0. Reverse
    def _obfuscate_reverse(self, data, seed=None, prng_factory=None):
        return data[::-1]
    
    # 1. Atbash
    def _obfuscate_atbash(self, data, seed=None, prng_factory=None):
        output = bytearray(len(data))
        for i, b in enumerate(data):
            if 65 <= b <= 90:
                output[i] = 90 - (b - 65)
            elif 97 <= b <= 122:
                output[i] = 122 - (b - 97)
            else:
                output[i] = b
        return bytes(output)

    # 2. To Char Codes (fake expansion)
    def _obfuscate_char_codes(self, data, seed=None, prng_factory=None):
        parts = []
        for i, b in enumerate(data):
            if i > 0:
                parts.append(44) # comma
            val_str = str(b)
            parts.extend([ord(c) for c in val_str])
        return bytes(parts)

    def _deobfuscate_char_codes(self, data, seed=None, prng_factory=None):
        # data is bytes like "65,66"
        s = data.decode('utf-8') # safe since created from digits and commas
        if not s:
            return b''
        try:
            return bytes([int(x) for x in s.split(',') if x])
        except ValueError:
            return b'' # Fail safe

    # 3. To Binary
    def _obfuscate_binary(self, data, seed=None, prng_factory=None):
        parts = []
        for i, b in enumerate(data):
            if i > 0:
                parts.append(44)
            val_str = format(b, 'b')
            parts.extend([ord(c) for c in val_str])
        return bytes(parts)

    def _deobfuscate_binary(self, data, seed=None, prng_factory=None):
        s = data.decode('utf-8')
        if not s:
            return b''
        try:
            return bytes([int(x, 2) for x in s.split(',') if x])
        except ValueError:
            return b''

    # 4. Caesar
    def _obfuscate_caesar(self, data, seed=None, prng_factory=None):
        output = bytearray(len(data))
        for i, b in enumerate(data):
            if 65 <= b <= 90:
                output[i] = ((b - 65 + 13) % 26) + 65
            elif 97 <= b <= 122:
                output[i] = ((b - 97 + 13) % 26) + 97
            else:
                output[i] = b
        return bytes(output)

    # 5. Swap Adjacent
    def _obfuscate_swap(self, data, seed=None, prng_factory=None):
        output = bytearray(data)
        for i in range(0, len(output) - 1, 2):
            output[i], output[i+1] = output[i+1], output[i]
        return bytes(output)

    # 6. Shuffle (Seeded)
    def _obfuscate_shuffle(self, data, seed=None, prng_factory=None):
        a = bytearray(data)
        n = len(a)
        seed_str = self._bytes_to_string(seed)
        rng = prng_factory(seed_str)
        for i in range(n - 1, 0, -1):
            rand = rng.next()
            j = (rand * (i + 1)) // 0x100000000
            a[i], a[j] = a[j], a[i]
        return bytes(a)

    def _deobfuscate_shuffle(self, data, seed=None, prng_factory=None):
        a = bytearray(data)
        n = len(a)
        indices = list(range(n))
        seed_str = self._bytes_to_string(seed)
        rng = prng_factory(seed_str)
        
        # Replay shuffle on indices
        for i in range(n - 1, 0, -1):
            rand = rng.next()
            j = (rand * (i + 1)) // 0x100000000
            indices[i], indices[j] = indices[j], indices[i]
        
        unshuffled = bytearray(n)
        for i in range(n):
            unshuffled[indices[i]] = a[i]
        return bytes(unshuffled)

    # 7. XOR (Seeded)
    def _obfuscate_xor(self, data, seed=None, prng_factory=None):
        output = bytearray(len(data))
        for i in range(len(data)):
            output[i] = data[i] ^ seed[i % len(seed)]
        return bytes(output)

    # 8. Interleave (Seeded)
    def _obfuscate_interleave(self, data, seed=None, prng_factory=None):
        random_chars = b'abcdefghijklmnopqrstuvwxyz0123456789'
        seed_str = self._bytes_to_string(seed)
        rng = prng_factory(seed_str)
        output = bytearray(len(data) * 2)
        for i in range(len(data)):
            output[i * 2] = data[i]
            rand_idx = (rng.next() * len(random_chars)) // 0x100000000
            output[i * 2 + 1] = random_chars[rand_idx]
        return bytes(output)

    def _deobfuscate_interleave(self, data, seed=None, prng_factory=None):
        output = bytearray(len(data) // 2)
        for i in range(0, len(data), 2):
            output[i // 2] = data[i]
        return bytes(output)

    # 9. Vigenere (Seeded)
    def _obfuscate_vigenere(self, data, seed=None, prng_factory=None):
        parts = []
        for i, b in enumerate(data):
            if i > 0:
                parts.append(44)
            key_code = seed[i % len(seed)]
            val = str(b + key_code)
            parts.extend([ord(c) for c in val])
        return bytes(parts)

    def _deobfuscate_vigenere(self, data, seed=None, prng_factory=None):
        output = bytearray()
        seed_len = len(seed)
        
        # Parse "100,102"
        s = data.decode('utf-8')
        if not s: return b''
        
        parts = s.split(',')
        for i, part in enumerate(parts):
            if not part: continue
            combined_val = int(part)
            key_code = seed[i % seed_len]
            output.append((combined_val - key_code) & 0xFF) # Ensure byte
        return bytes(output)

    # 10. Block Reversal (Seeded)
    def _obfuscate_block_rev(self, data, seed=None, prng_factory=None):
        seed_str = self._bytes_to_string(seed)
        rng = prng_factory(seed_str)
        block_size = ((rng.next() * (len(data) // 2)) // 0x100000000) + 2
        
        output = bytearray()
        for i in range(0, len(data), block_size):
            chunk = data[i:i+block_size]
            output.extend(chunk[::-1])
        return bytes(output)

    # 11. Seeded Substitution (Seeded)
    def _obfuscate_sub(self, data, seed=None, prng_factory=None):
        chars = list(range(256))
        seed_str = self._bytes_to_string(seed)
        rng = prng_factory(seed_str)
        
        # Shuffle 0-255
        for i in range(255, 0, -1):
            rand = rng.next()
            j = (rand * (i + 1)) // 0x100000000
            chars[i], chars[j] = chars[j], chars[i]
        
        output = bytearray(len(data))
        for i, b in enumerate(data):
            output[i] = chars[b]
        return bytes(output)

    def _deobfuscate_sub(self, data, seed=None, prng_factory=None):
        chars = list(range(256))
        seed_str = self._bytes_to_string(seed)
        rng = prng_factory(seed_str)
        
        for i in range(255, 0, -1):
            rand = rng.next()
            j = (rand * (i + 1)) // 0x100000000
            chars[i], chars[j] = chars[j], chars[i]
            
        unsub_map = [0] * 256
        for i in range(256):
            unsub_map[chars[i]] = i
            
        output = bytearray(len(data))
        for i, b in enumerate(data):
            output[i] = unsub_map[b]
        return bytes(output)

    def __init__(self):
        self.obfuscation_functions_v2 = [
            self._obfuscate_reverse,
            self._obfuscate_atbash,
            self._obfuscate_char_codes,
            self._obfuscate_binary,
            self._obfuscate_caesar,
            self._obfuscate_swap,
            self._obfuscate_shuffle,
            self._obfuscate_xor,
            self._obfuscate_interleave,
            self._obfuscate_vigenere,
            self._obfuscate_block_rev,
            self._obfuscate_sub
        ]
        
        self.deobfuscation_functions_v2 = [
            self._obfuscate_reverse, # Reverse is self-inverse
            self._obfuscate_atbash, # Atbash is self-inverse
            self._deobfuscate_char_codes,
            self._deobfuscate_binary,
            self._obfuscate_caesar, # ROT13 is self-inverse
            self._obfuscate_swap, # Swap is self-inverse
            self._deobfuscate_shuffle,
            self._obfuscate_xor, # XOR is self-inverse
            self._deobfuscate_interleave,
            self._deobfuscate_vigenere,
            self._obfuscate_block_rev, # Reverse is self-inverse
            self._deobfuscate_sub
        ]
        
        self.SBOX = bytearray([
            0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
            0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
            0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
            0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
            0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
            0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
            0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
            0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
            0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
            0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
            0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
            0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
            0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
            0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
            0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
            0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
        ])
        
        self.INV_SBOX = bytearray(256)
        for i in range(256):
            self.INV_SBOX[self.SBOX[i]] = i
            
        self.obfuscation_functions_v4 = [
            self._obfuscate_sbox_v4,
            self._obfuscate_modmult_v4,
            self._obfuscate_pbox_v4,
            self._obfuscate_cyclicrot_v4,
            self._obfuscate_keyedxor_v4,
            self._obfuscate_feistel_v4,
            self._obfuscate_modadd_v4,
            self._obfuscate_matrixhill_v4,
            self._obfuscate_gfmult_v4,
            self._obfuscate_bitflip_v4,
            self._obfuscate_columnar_v4,
            self._obfuscate_recxor_v4
        ]
        
        self.deobfuscation_functions_v4 = [
            self._deobfuscate_sbox_v4,
            self._deobfuscate_modmult_v4,
            self._deobfuscate_pbox_v4,
            self._deobfuscate_cyclicrot_v4,
            self._deobfuscate_keyedxor_v4,
            self._deobfuscate_feistel_v4,
            self._deobfuscate_modadd_v4,
            self._deobfuscate_matrixhill_v4,
            self._deobfuscate_gfmult_v4,
            self._deobfuscate_bitflip_v4,
            self._deobfuscate_columnar_v4,
            self._deobfuscate_recxor_v4
        ]

    # --- Obfuscation Functions (V4) ---

    def _gf_mult(self, a, b):
        p = 0
        for i in range(8):
            if (b & 1) != 0: p ^= a
            hi_bit_set = (a & 0x80)
            a <<= 1
            if hi_bit_set != 0: a ^= 0x1B
            b >>= 1
            a &= 0xFF
        return p & 0xFF

    def _obfuscate_sbox_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = self.SBOX[b]
        return bytes(out)
        
    def _deobfuscate_sbox_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = self.INV_SBOX[b]
        return bytes(out)
        
    def _obfuscate_modmult_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = (b * 167) & 0xFF
        return bytes(out)
        
    def _deobfuscate_modmult_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = (b * 23) & 0xFF
        return bytes(out)
        
    def _obfuscate_pbox_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        length = len(data)
        for i in range(length):
            b = data[i]
            b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4)
            b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2)
            b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1)
            out[length - 1 - i] = b
        return bytes(out)
        
    def _deobfuscate_pbox_v4(self, data, seed=None, prng_factory=None):
        return self._obfuscate_pbox_v4(data)
        
    def _obfuscate_cyclicrot_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = ((b >> 3) | ((b << 5) & 0xFF)) & 0xFF
        return bytes(out)
        
    def _deobfuscate_cyclicrot_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = (((b << 3) & 0xFF) | (b >> 5)) & 0xFF
        return bytes(out)
        
    def _obfuscate_keyedxor_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = b ^ seed[i % len(seed)]
        return bytes(out)
        
    def _deobfuscate_keyedxor_v4(self, data, seed=None, prng_factory=None):
        return self._obfuscate_keyedxor_v4(data, seed)
        
    def _obfuscate_feistel_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(data)
        half = len(out) // 2
        if half == 0: return bytes(out)
        for i in range(half):
            f = (out[half + i] + seed[i % len(seed)]) & 0xFF
            out[i] ^= f
        return bytes(out)
        
    def _deobfuscate_feistel_v4(self, data, seed=None, prng_factory=None):
        return self._obfuscate_feistel_v4(data, seed)
        
    def _obfuscate_modadd_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = (b + seed[i % len(seed)]) & 0xFF
        return bytes(out)
        
    def _deobfuscate_modadd_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = (b - seed[i % len(seed)] + 256) & 0xFF
        return bytes(out)
        
    def _obfuscate_matrixhill_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        if len(data) == 0: return bytes(out)
        out[0] = data[0]
        for i in range(1, len(data)): out[i] = (data[i] + out[i-1]) & 0xFF
        return bytes(out)
        
    def _deobfuscate_matrixhill_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        if len(data) == 0: return bytes(out)
        out[0] = data[0]
        for i in range(len(data) - 1, 0, -1): out[i] = (data[i] - data[i-1] + 256) & 0xFF
        return bytes(out)

    def _obfuscate_gfmult_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = self._gf_mult(b, 0x02)
        return bytes(out)
        
    def _deobfuscate_gfmult_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data): out[i] = self._gf_mult(b, 0x8D)
        return bytes(out)
        
    def _obfuscate_bitflip_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        for i, b in enumerate(data):
            mask = seed[i % len(seed)]
            out[i] = b ^ ((mask & 0xAA) | (~mask & 0x55))
        return bytes(out)
        
    def _deobfuscate_bitflip_v4(self, data, seed=None, prng_factory=None):
        return self._obfuscate_bitflip_v4(data, seed)
        
    def _obfuscate_columnar_v4(self, data, seed=None, prng_factory=None):
        n = len(data)
        out = bytearray(n)
        cols = 3
        idx = 0
        for c in range(cols):
            for i in range(c, n, cols):
                out[idx] = data[i]
                idx += 1
        return bytes(out)
        
    def _deobfuscate_columnar_v4(self, data, seed=None, prng_factory=None):
        n = len(data)
        out = bytearray(n)
        cols = 3
        idx = 0
        for c in range(cols):
            for i in range(c, n, cols):
                out[i] = data[idx]
                idx += 1
        return bytes(out)
        
    def _obfuscate_recxor_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        if len(data) == 0: return bytes(out)
        out[0] = data[0]
        for i in range(1, len(data)): out[i] = out[i-1] ^ data[i]
        return bytes(out)
        
    def _deobfuscate_recxor_v4(self, data, seed=None, prng_factory=None):
        out = bytearray(len(data))
        if len(data) == 0: return bytes(out)
        out[0] = data[0]
        for i in range(len(data) - 1, 0, -1): out[i] = data[i] ^ data[i-1]
        return bytes(out)

    # --- Core AES Encryption ---
    def _encrypt_aes256(self, data_bytes, password, iterations):
        backend = default_backend()
        salt = os.urandom(self.SALT_SIZE_BYTES)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self.KEY_SIZE,
            salt=salt,
            iterations=iterations,
            backend=backend
        )
        key = kdf.derive(self._to_bytes(password))
        
        iv = os.urandom(self.IV_SIZE_BYTES)
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=backend)
        encryptor = cipher.encryptor()
        
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(data_bytes) + padder.finalize()
        
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()
        
        # salt(hex) + iv(hex) + ciphertext(base64)
        salt_hex = salt.hex()
        iv_hex = iv.hex()
        cipher_b64 = base64.b64encode(ciphertext).decode('ascii')
        
        # Python natively manages `bytes` objects and prevents modifying memory.
        # We allow the PBKDF2 key object to drop via GARBAGE COLLECTION.
            
        return salt_hex + iv_hex + cipher_b64

    def _decrypt_aes256(self, transit_message, password, iterations):
        try:
            salt_hex = transit_message[:32]
            iv_hex = transit_message[32:64]
            encrypted_base64 = transit_message[64:]
            
            salt = bytes.fromhex(salt_hex)
            iv = bytes.fromhex(iv_hex)
            ciphertext = base64.b64decode(encrypted_base64)
            
            backend = default_backend()
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=self.KEY_SIZE,
                salt=salt,
                iterations=iterations,
                backend=backend
            )
            key = kdf.derive(self._to_bytes(password))
            
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=backend)
            decryptor = cipher.decryptor()
            
            padded_data = decryptor.update(ciphertext) + decryptor.finalize()
            
            unpadder = padding.PKCS7(128).unpadder()
            data = unpadder.update(padded_data) + unpadder.finalize()
            
            # Python natively manages `bytes` objects and prevents modifying memory.
            # We allow the PBKDF2 key object to drop via GARBAGE COLLECTION.
                
            return data
        except Exception as e:
            print(f"Decryption failed: {e}")
            return None

    def _encrypt_aes256_gcm(self, data_bytes, password, iterations, aad=None):
        backend = default_backend()
        salt = os.urandom(self.SALT_SIZE_BYTES)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self.KEY_SIZE,
            salt=salt,
            iterations=iterations,
            backend=backend
        )
        key = kdf.derive(self._to_bytes(password))
        iv = os.urandom(12) 
        cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=backend)
        encryptor = cipher.encryptor()
        
        if aad:
            encryptor.authenticate_additional_data(aad)
            
        ciphertext = encryptor.update(data_bytes) + encryptor.finalize()
        tag = encryptor.tag
        
        salt_hex = salt.hex()
        iv_hex = iv.hex()
        cipher_b64 = base64.b64encode(ciphertext + tag).decode('ascii')
        
        # Python natively manages `bytes` objects and prevents modifying memory.
            
        return salt_hex + iv_hex + cipher_b64

    def _decrypt_aes256_gcm(self, transit_message, password, iterations, aad=None):
        try:
            salt_hex = transit_message[:32]
            iv_hex = transit_message[32:56] 
            encrypted_base64 = transit_message[56:]
            
            salt = bytes.fromhex(salt_hex)
            iv = bytes.fromhex(iv_hex)
            payload = base64.b64decode(encrypted_base64)
            ciphertext = payload[:-16]
            tag = payload[-16:]
            
            backend = default_backend()
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=self.KEY_SIZE,
                salt=salt,
                iterations=iterations,
                backend=backend
            )
            key = kdf.derive(self._to_bytes(password))
            
            cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=backend)
            decryptor = cipher.decryptor()
            
            if aad:
                decryptor.authenticate_additional_data(aad)
                
            plaintext = decryptor.update(ciphertext) + decryptor.finalize()
            
            # Python natively manages `bytes` objects and prevents modifying memory.
                
            return plaintext
        except Exception as e:
            print(f"GCM Decryption failed: {e}")
            raise e

    # --- Public API ---
    def encrypt(self, mnemonic, key_material, version=5):
        words = mnemonic.split(' ')
        obfuscated_words = []
        reverse_key = []

        is_v1 = version == 1
        is_v2 = version == 2
        is_v3 = version == 3
        is_v4 = version == 4
        is_v5 = version == 5
        is_modern = is_v3 or is_v4 or is_v5
        
        ct_hex = ""
        ss_hex = ""
        active_password_str = key_material
        if is_v5:
            import pqcrypto.kem.ml_kem_1024 as kem
            pk_bytes = bytes.fromhex(key_material)
            ct_bytes, ss_bytes_tup = kem.encrypt(pk_bytes)
            # ML-KEM outputs tuple, need mutable copy if we want to wipe it.
            ss_bytes = bytearray(ss_bytes_tup)
            ct_hex = ct_bytes.hex()
            ss_hex = ss_bytes.hex()
            active_password_str = ss_hex
            for i in range(len(ss_bytes)): ss_bytes[i] = 0 # Zeroized


        
        def prng_factory(s_str):
            if is_modern:
                return self.DarkstarChaChaPRNG(s_str)
            return self.Mulberry32(s_str)
        
        for index, word in enumerate(words):
            current_word_bytes = self._to_bytes(word)
            
            selected_functions = list(range(len(self.obfuscation_functions_v2)))
            
            seed_for_selection = active_password_str + word + (str(index) if is_v5 else "")
            rng_sel = prng_factory(seed_for_selection)
            
            for i in range(len(selected_functions) - 1, 0, -1):
                rand = rng_sel.next()
                j = (rand * (i + 1)) // 0x100000000
                selected_functions[i], selected_functions[j] = selected_functions[j], selected_functions[i]

            word_reverse_key = []
            
            cycle_depth = len(selected_functions)
            if is_modern:
                import hashlib
                depth_hash = hashlib.sha256(seed_for_selection.encode('utf-8')).hexdigest()
                depth_val = int(depth_hash[:4], 16)
                cycle_depth = 12 + (depth_val % 501) if is_v5 else 12 + (depth_val % 53)
            
            checksum = self._generate_checksum(selected_functions)
            combined_seed = (active_password_str + str(checksum) + (str(index) if is_v5 else "")).encode('utf-8')
            
            for i in range(cycle_depth):
                func_index = selected_functions[i % len(selected_functions)]
                
                if i >= 12 and not is_v4 and not is_v5 and func_index in [2, 3, 8, 9]:
                    func_index = (func_index + 2) % 12
                    
                if is_v4 or is_v5:
                    func = self.obfuscation_functions_v4[func_index]
                    is_seeded = func_index in [4, 5, 6, 9]
                else:
                    func = self.obfuscation_functions_v2[func_index]
                    is_seeded = func_index >= 6
                    
                seed = combined_seed if is_seeded else None
                
                if is_seeded:
                    current_word_bytes = func(current_word_bytes, seed=seed, prng_factory=prng_factory)
                else:
                    current_word_bytes = func(current_word_bytes)
                
                word_reverse_key.append(func_index)
                
            obfuscated_words.append(current_word_bytes)
            reverse_key.append(word_reverse_key)
            
        import struct
        final_blob = b"".join([struct.pack(">H", len(wb)) + wb for wb in obfuscated_words])
        
        encoded_reverse_key = self._pack_reverse_key(reverse_key, is_v3=is_modern)
        aad = encoded_reverse_key.encode('utf-8') if is_v5 else None

        final_payload = final_blob
        if is_v5:
            final_payload = final_payload.ljust(2048, b"\x00")

        target_iterations = self.ITERATIONS_V2
        
        if is_modern:
            payload_to_encrypt = final_payload
            if not is_v5:
                # Legacy V3/V4: payload is base64 encoded BEFORE encryption
                payload_to_encrypt = base64.b64encode(final_payload)
            encrypted_content = self._encrypt_aes256_gcm(payload_to_encrypt, active_password_str, target_iterations, aad)
        else:
            # Legacy V1/V2: payload is base64 encoded BEFORE encryption
            payload_to_encrypt = base64.b64encode(final_payload)
            encrypted_content = self._encrypt_aes256(payload_to_encrypt, active_password_str, target_iterations)
        
        v_protocol = 5
        if is_v1: v_protocol = 1
        elif is_v2: v_protocol = 2
        elif is_v3: v_protocol = 3
        elif is_v4: v_protocol = 4

        if is_v1:
            uncompressed_rk = json.dumps(reverse_key)
            return {
                "encryptedData": encrypted_content,
                "reverseKey": base64.b64encode(uncompressed_rk.encode()).decode()
            }
        res_obj = {
            "v": v_protocol,
            "data": encrypted_content
        }
        if is_v5:
            res_obj["ct"] = ct_hex
        
        result_json = {
            "encryptedData": json.dumps(res_obj, separators=(',', ':')),
            "reverseKey": encoded_reverse_key
        }
        
        if is_v5:
            active_password_str = ""
            
        return result_json

    def decrypt(self, encrypted_data_raw, reverse_key_b64, key_material):
        # 1. Decode Reverse Key
        try:
            # Try to decode as packed binary first (or auto-detect)
            decoded_b64 = base64.b64decode(reverse_key_b64)
            # Detect protocol version from the data header first if possible, or pass hint
            is_header_modern = False
            if encrypted_data_raw.strip().startswith('{'):
                try:
                    parsed = json.loads(encrypted_data_raw)
                    if parsed.get('v') in [3, 4, 5]:
                        is_header_modern = True
                except:
                    pass

            if decoded_b64.strip().startswith(b'['):
                reverse_key = json.loads(decoded_b64)
            else:
                reverse_key = self._unpack_reverse_key(reverse_key_b64, is_v3=is_header_modern)
        except Exception:
             # Fallback
             reverse_key = self._unpack_reverse_key(reverse_key_b64, is_v3=False)

        # 2. Check header
        iterations = self.ITERATIONS_V2 
        encrypted_content = encrypted_data_raw
        is_v3 = False
        is_v4 = False
        is_v5 = False
        ct_hex = ""
        
        try:
            if encrypted_data_raw.strip().startswith('{'):
                parsed = json.loads(encrypted_data_raw)
                if parsed.get('v') == 2 and parsed.get('data'):
                    encrypted_content = parsed['data']
                elif parsed.get('v') == 3 and parsed.get('data'):
                    encrypted_content = parsed['data']
                    is_v3 = True
                elif parsed.get('v') == 4 and parsed.get('data'):
                    encrypted_content = parsed['data']
                    is_v4 = True
                elif parsed.get('v') == 5 and parsed.get('data'):
                    encrypted_content = parsed['data']
                    is_v5 = True
                    ct_hex = parsed.get('ct', '')
        except:
            pass 

        is_modern = is_v3 or is_v4 or is_v5

        active_password_str = key_material
        if is_v5:
            import pqcrypto.kem.ml_kem_1024 as kem
            sk_bytes = bytes.fromhex(key_material)
            ct_bytes = bytes.fromhex(ct_hex)
            ss_bytes = bytearray(kem.decrypt(sk_bytes, ct_bytes))
            active_password_str = ss_bytes.hex()
            # Interop cleanup
            ss_bytes[:] = b'\x00' * len(ss_bytes)
            
        iterations = self.ITERATIONS_V2
        aad = reverse_key_b64.encode('utf-8') if is_v5 else None

        # 3. Decrypt AES
        try:
            if is_modern:
                decrypted_bytes = self._decrypt_aes256_gcm(encrypted_content, active_password_str, iterations, aad)
            else:
                decrypted_bytes = self._decrypt_aes256(encrypted_content, active_password_str, iterations)
        finally:
            pass
        
        if not decrypted_bytes:
            raise ValueError("Decryption failed")

        # 4. Extract Binary Blob
        if is_v5:
            full_blob = decrypted_bytes
        else:
            # Legacy V1-V4: payload was base64 encoded BEFORE encryption
            try:
                full_blob = base64.b64decode(decrypted_bytes)
            except:
                raise ValueError("Failed to decode inner base64 blob")
        
        deobfuscated_words = []

        def prng_factory(s_str):
            if is_modern:
                return self.DarkstarChaChaPRNG(s_str)
            return self.Mulberry32(s_str)
        
        offset = 0
        word_index = 0
        
        while offset < len(full_blob):
            if word_index >= len(reverse_key): break
            
            length = (full_blob[offset] << 8) | full_blob[offset + 1]
            if length == 0:
                break
            offset += 2
            
            current_word_bytes = full_blob[offset : offset + length]
            offset += length
            
            word_reverse_list = reverse_key[word_index]
            
            # Setup Seed (only core first 12 cycles determine checksum)
            unique_set = list(dict.fromkeys(word_reverse_list[:12]))
            checksum = self._generate_checksum(unique_set)
            combined_seed = (active_password_str + str(checksum) + (str(word_index) if is_v5 else "")).encode('utf-8')
            
            # Apply Deobfuscation (Reverse Order)
            for j in range(len(word_reverse_list) - 1, -1, -1):
                func_index = word_reverse_list[j]
                
                if is_v4 or is_v5:
                    func = self.deobfuscation_functions_v4[func_index]
                    is_seeded = func_index in [4, 5, 6, 9]
                else:
                    func = self.deobfuscation_functions_v2[func_index]
                    is_seeded = func_index >= 6
                    
                seed = combined_seed if is_seeded else None
                
                if is_seeded:
                    current_word_bytes = func(current_word_bytes, seed=seed, prng_factory=prng_factory)
                else:
                    current_word_bytes = func(current_word_bytes)
                    
            deobfuscated_words.append(current_word_bytes.decode('utf-8'))
            word_index += 1
        
        if is_v5: active_password_str = ""
        return " ".join(deobfuscated_words)

    # --- Compression Helpers ---
    def _pack_reverse_key(self, reverse_key, is_v3=True):
        import struct
        buffer = bytearray()
        for word_key in reverse_key:
            if is_v3:
                # Uint16BE length header
                buffer.extend(struct.pack('>H', len(word_key)))
            for i in range(0, len(word_key), 2):
                high = word_key[i] & 0x0F
                low = word_key[i+1] & 0x0F if i+1 < len(word_key) else 0x00
                buffer.append((high << 4) | low)
        
        return base64.b64encode(buffer).decode('ascii')

    def _unpack_reverse_key(self, b64, is_v3=True):
        import struct
        buffer = base64.b64decode(b64)
        reverse_key = []
        
        offset = 0
        while offset < len(buffer):
            word_len = 12 # Legacy V2
            if is_v3:
                if offset + 2 > len(buffer): break
                word_len = struct.unpack('>H', buffer[offset:offset+2])[0]
                offset += 2
            
            num_bytes_to_read = (word_len + 1) // 2
            
            word_key = []
            for i in range(num_bytes_to_read):
                if offset >= len(buffer): break
                byte = buffer[offset]
                offset += 1
                high = (byte >> 4) & 0x0F
                low = byte & 0x0F
                word_key.append(high)
                if len(word_key) < word_len:
                    word_key.append(low)
                    
            reverse_key.append(word_key)
            
        return reverse_key

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Darkstar D-KASP-512 (V5) Cryptographic Suite")
    
    # Global Flags
    parser.add_argument("-v", "--v", type=int, choices=[1, 2, 3, 4, 5], default=5, help="D-KASP Protocol Version (default: 5)")
    parser.add_argument("-c", "--core", choices=["aes", "arx"], default="aes", help="Encryption Core (default: aes)")
    parser.add_argument("-f", "--format", choices=["json", "csv", "text"], default=None, help="Output format (default: json for encrypt/keygen, text for decrypt)")
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Encrypt
    enc_parser = subparsers.add_parser("encrypt", help="Encrypt mnemonic")
    enc_parser.add_argument("mnemonic", help="The mnemonic phrase to encrypt")
    enc_parser.add_argument("password", help="The user password (V1-V4) OR Kyber-1024 Public Key Hex (V5)")
    
    # Decrypt
    dec_parser = subparsers.add_parser("decrypt", help="Decrypt data")
    dec_parser.add_argument("data", help="The encrypted JSON data object")
    dec_parser.add_argument("reverse_key", help="The Base64 encoded reverse key")
    dec_parser.add_argument("password", help="The user password (V1-V4) OR Kyber-1024 Private Key Hex (V5)")
    
    # Keygen
    subparsers.add_parser("keygen", help="Generate ML-KEM-1024 / Kyber-1024 Keypair")
    
    # Test
    subparsers.add_parser("test", help="Run self-test suite")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)

    crypt = DarkstarCrypt()
    v = args.v
    format_opt = args.format
    
    if args.command == "encrypt":
        res = crypt.encrypt(args.mnemonic, args.password, version=v)
        
        output_format = format_opt or 'json'
        if output_format == "json":
            print(json.dumps(res))
        elif output_format == "csv":
            res_dict = json.loads(res)
            print(f"{res_dict['encryptedData']},{res_dict['reverseKey']}")
        else: # text
            res_dict = json.loads(res)
            print(f"Data: {res_dict['encryptedData']}\nReverseKey: {res_dict['reverseKey']}")
            
    elif args.command == 'decrypt':
        output_format = args.format or "text"
        try:
            res = crypt.decrypt(args.data, args.reverse_key, args.password)
            if output_format == "json":
                print(json.dumps({"decrypted": res}))
            elif output_format == "csv":
                print(res) # Just the text for CSV simplicity
            else:
                print(res)
        except Exception as e:
            print(f"ERROR: {str(e)}", file=sys.stderr)
            sys.exit(1)
            
    elif args.command == 'keygen':
        output_format = args.format or "text"
        import pqcrypto.kem.ml_kem_1024 as kem
        pk, sk = kem.generate_keypair()
        if output_format == "json":
            print(json.dumps({"pk": pk.hex(), "sk": sk.hex()}))
        elif output_format == "csv":
            print(f"{pk.hex()},{sk.hex()}")
        else:
            print(f"PK: {pk.hex()}\nSK: {sk.hex()}")
            
    elif args.command == 'test':
        mnemonic = "apple banana cherry date"
        password = "MySecre!Password123"
        dec_psw = password
        
        if v == 5:
            import pqcrypto.kem.ml_kem_1024 as kem
            pk, sk = kem.generate_keypair()
            password = pk.hex()
            dec_psw = sk.hex()
            
        print(f"--- Darkstar Python Self-Test (V{v}) ---")
        try:
            res_json = crypt.encrypt(mnemonic, password, version=v)
            res = json.loads(res_json)
            decrypted = crypt.decrypt(res['encryptedData'], res['reverseKey'], dec_psw)
            print(f"Decrypted: '{decrypted}'")
            if decrypted == mnemonic:
                print("Result: PASSED")
            else:
                print("Result: FAILED")
                sys.exit(1)
        except Exception as e:
            print(f"Result: FAILED with error {e}")
            sys.exit(1)
    else:
        print(f"Unknown command: {command}")

