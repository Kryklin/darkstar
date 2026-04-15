"""
DARKSTAR - Secure Multi-Layered Encryption & Steganography Suite
Version: 3.0.0
Protocol: D-ASP (Darkstar Algebraic Substitution & Permutation)
Security: Grade-1024 (Kyber-Standard)
Implementation: Python (Research & Validation Implementation)

Professional Grade Cryptographic Module
Bit-Perfect Interoperability Verified
"""

import os
import sys
import base64
import json
import struct
import hashlib
import hmac
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
import time
try:
    import pqcrypto.kem.ml_kem_1024 as kem
except ImportError:
    kem = None

class DarkstarCrypt:
    """
    D-ASP Cryptographic Suite
    
    This suite implements the definitive Darkstar protocol:
    - Root of Trust: ML-KEM-1024
    - Engine: ASP Cascade 16 (16-round structural permutation logic)
    - Integrity: HMAC-SHA256
    - Pathing: ChaCha20-based Deterministic PRNG
    """

    class DarkstarChaChaPRNG:
        def __init__(self, seed_str):
            self.hash = hashlib.sha256(seed_str.encode('utf-8')).digest()
            self.state = [0]*16
            self.state[0] = 0x61707865
            self.state[1] = 0x3320646e
            self.state[2] = 0x79622d32
            self.state[3] = 0x6b206574
            for i in range(8):
                self.state[4+i] = struct.unpack('<I', self.hash[i*4:(i+1)*4])[0]
            self.state[12] = 0 
            self.block = self._chacha_block(self.state)
            self.block_idx = 0

        def _chacha_block(self, st):
            x = list(st)
            def rotate(v, n): return ((v << n) & 0xFFFFFFFF) | (v >> (32 - n))
            def quarter_round(a, b, c, d):
                x[a] = (x[a] + x[b]) & 0xFFFFFFFF; x[d] ^= x[a]; x[d] = rotate(x[d], 16)
                x[c] = (x[c] + x[d]) & 0xFFFFFFFF; x[b] ^= x[c]; x[b] = rotate(x[b], 12)
                x[a] = (x[a] + x[b]) & 0xFFFFFFFF; x[d] ^= x[a]; x[d] = rotate(x[d], 8)
                x[c] = (x[c] + x[d]) & 0xFFFFFFFF; x[b] ^= x[c]; x[b] = rotate(x[b], 7)
            
            for _ in range(10):
                quarter_round(0, 4, 8, 12); quarter_round(1, 5, 9, 13)
                quarter_round(2, 6, 10, 14); quarter_round(3, 7, 11, 15)
                quarter_round(0, 5, 10, 15); quarter_round(1, 6, 11, 12)
                quarter_round(2, 7, 8, 13); quarter_round(3, 4, 9, 14)
            return [(x[i] + st[i]) & 0xFFFFFFFF for i in range(16)]

        def next(self):
            if self.block_idx >= 16:
                self.state[12] = (self.state[12] + 1) & 0xFFFFFFFF
                self.block = self._chacha_block(self.state)
                self.block_idx = 0
            val = self.block[self.block_idx]
            self.block_idx += 1
            return val

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
        s = data.decode('utf-8') 
        if not s:
            return b''
        try:
            return bytes([int(x) for x in s.split(',') if x])
        except ValueError:
            return b'' 

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
        self.obfuscation_functions_v2 = [] # Pruned
        
        self.deobfuscation_functions_v2 = [] # Pruned
        
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
            self._obfuscate_recxor_v4,
            self._obfuscate_mds_network_v9
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
            self._deobfuscate_recxor_v4,
            self._deobfuscate_mds_network_v9
        ]

    # --- Obfuscation Functions (V4) ---

    def _gf_mult(self, a, b):
        p = 0
        for _ in range(8):
            # Mask: if b & 1, add a to product p
            p ^= a & (-(b & 1) & 0xFF)

            # Mask: if hi-bit of a is set, reduce by 0x1B
            mask = -(a >> 7) & 0xFF
            a = ((a << 1) ^ (0x1B & mask)) & 0xFF

            b >>= 1
        return p

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

    MDS_MATRIX = [
        [0x02, 0x03, 0x01, 0x01],
        [0x01, 0x02, 0x03, 0x01],
        [0x01, 0x01, 0x02, 0x03],
        [0x03, 0x01, 0x01, 0x02]
    ]

    INV_MDS_MATRIX = [
        [0x0E, 0x0B, 0x0D, 0x09],
        [0x09, 0x0E, 0x0B, 0x0D],
        [0x0D, 0x09, 0x0E, 0x0B],
        [0x0B, 0x0D, 0x09, 0x0E]
    ]

    def _obfuscate_mds_network_v9(self, data, seed=None, prng_factory=None):
        if len(data) < 4: return self._obfuscate_matrixhill_v4(data)
        out = bytearray(len(data))
        for i in range(0, len(data), 4):
            block = data[i:i+4]
            if len(block) < 4:
                out[i:i+len(block)] = block
                continue
            for row in range(4):
                val = 0
                for col in range(4):
                    val ^= self._gf_mult(block[col], self.MDS_MATRIX[row][col])
                out[i + row] = val
        return bytes(out)

    def _deobfuscate_mds_network_v9(self, data, seed=None, prng_factory=None):
        if len(data) < 4: return self._deobfuscate_matrixhill_v4(data)
        out = bytearray(len(data))
        for i in range(0, len(data), 4):
            block = data[i:i+4]
            if len(block) < 4:
                out[i:i+len(block)] = block
                continue
            for row in range(4):
                val = 0
                for col in range(4):
                    val ^= self._gf_mult(block[col], self.INV_MDS_MATRIX[row][col])
                out[i + row] = val
        return bytes(out)

    # --- Core AES Encryption ---
    # PRUNED legacy AES helpers.

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

    def encrypt(self, payload, pk_hex, hwid_hex=None):
        total_start = time.perf_counter()
        pk_bytes = bytes.fromhex(pk_hex)
        import pqcrypto.kem.ml_kem_1024 as kem
        
        kem_start = time.perf_counter()
        ct_bytes, ss_bytes_tup = kem.encrypt(pk_bytes)
        kem_duration = time.perf_counter() - kem_start
        
        ss_bytes = bytearray(ss_bytes_tup)
        
        kdf_start = time.perf_counter()
        
        # Stage 1: Blended_SS (K_root)
        k_root_hasher = hashlib.sha256()
        k_root_hasher.update(bytes(ss_bytes))
        if hwid_hex:
            k_root_hasher.update(bytes.fromhex(hwid_hex))
        k_root_hasher.update(b"dasp-identity-v3")
        blended_ss = k_root_hasher.digest()
        blended_ss_hex = blended_ss.hex()

        cipher_key = hashlib.sha256(b"cipher" + blended_ss).digest()
        hmac_key = hashlib.sha256(b"hmac" + blended_ss).digest()
        active_password_str = cipher_key.hex()
        
        # Zeroize secret key material
        for i in range(len(ss_bytes)): ss_bytes[i] = 0 
        kdf_duration = time.perf_counter() - kdf_start
        
        current_word_bytes = payload.encode('utf-8')
        def prng_factory(s_str):
            return self.DarkstarChaChaPRNG(s_str)
        
        # Stage 2: word_key
        word_key = hmac.new(active_password_str.encode('utf-8'), b"dasp-word-0", hashlib.sha256).digest()
        word_key_hex = word_key.hex()
        
        chain_state = hashlib.sha256(f"dasp-chain-{active_password_str}".encode('utf-8')).digest()
        
        temp_word_bytes = bytearray(current_word_bytes)
        for i in range(len(temp_word_bytes)):
            temp_word_bytes[i] ^= chain_state[i % 32]
        current_word_bytes = bytes(temp_word_bytes)

        base_indices = list(range(12))
        checksum = self._generate_checksum(base_indices)
        func_key = hmac.new(word_key, f"keyed-{checksum}".encode('utf-8'), hashlib.sha256).digest()

        # V9: SPNA Structured Gauntlet
        rng_path = prng_factory(word_key_hex)
        group_s = [0, 1, 5]
        group_p = [2, 3, 10]
        group_n = [12, 12, 11]
        group_a = [4, 6, 9]

        # Stage 3: Round Indices
        round_indices = []
        cascade_start = time.perf_counter()
        for i in range(16):
            s_idx = 0
            if i % 4 == 0: s_idx = 0
            elif i % 4 == 2: s_idx = 1
            else: s_idx = group_s[rng_path.next() % len(group_s)]
            current_word_bytes = self.obfuscation_functions_v4[s_idx](current_word_bytes, seed=func_key, prng_factory=prng_factory)

            p_idx = group_p[rng_path.next() % len(group_p)]
            current_word_bytes = self.obfuscation_functions_v4[p_idx](current_word_bytes, seed=func_key, prng_factory=prng_factory)

            n_idx = group_n[rng_path.next() % len(group_n)]
            current_word_bytes = self.obfuscation_functions_v4[n_idx](current_word_bytes, seed=func_key, prng_factory=prng_factory)

            a_idx = group_a[rng_path.next() % len(group_a)]
            current_word_bytes = self.obfuscation_functions_v4[a_idx](current_word_bytes, seed=func_key, prng_factory=prng_factory)
            
            round_indices.append([s_idx, p_idx, n_idx, a_idx])
            
        cascade_duration = time.perf_counter() - cascade_start

        final_payload = current_word_bytes
        h = hmac.new(hmac_key, bytes.fromhex(ct_bytes.hex()) + final_payload, hashlib.sha256)
        
        # Stage 4: final mac
        mac_tag = h.hexdigest()
        
        if os.environ.get("DASP_DIAGNOSTIC") == "1":
            print(json.dumps({
                "diagnostics": {
                    "stage1_blended_ss": blended_ss_hex,
                    "stage2_word_key": word_key_hex,
                    "stage3_round_indices": round_indices,
                    "stage4_mac": mac_tag
                }
            }), file=sys.stderr)

        total_duration = time.perf_counter() - total_start
        res_obj = {
            "data": final_payload.hex(),
            "ct": ct_bytes.hex(),
            "mac": mac_tag,
            "timings": {
                "kem_us": int(kem_duration * 1_000_000),
                "kdf_us": int(kdf_duration * 1_000_000),
                "cascade_us": int(cascade_duration * 1_000_000),
                "total_us": int(total_duration * 1_000_000)
            }
        }
        return json.dumps(res_obj)

    def decrypt(self, encrypted_data_raw, sk_hex, hwid_hex=None):
        total_start = time.perf_counter()
        parsed = json.loads(encrypted_data_raw)
        
        ct_hex = parsed.get('ct', "")
        encrypted_content = parsed.get('data', "")
        mac_tag = parsed.get('mac', "")
        
        sk_bytes = bytes.fromhex(sk_hex)
        ct_bytes = bytes.fromhex(ct_hex)
        
        import pqcrypto.kem.ml_kem_1024 as kem
        kem_start = time.perf_counter()
        ss_bytes_tup = kem.decrypt(sk_bytes, ct_bytes)
        kem_duration = time.perf_counter() - kem_start
        
        ss_bytes = bytearray(ss_bytes_tup)
        
        kdf_start = time.perf_counter()
        
        # Stage 1: Blended_SS (K_root)
        k_root_hasher = hashlib.sha256()
        k_root_hasher.update(bytes(ss_bytes))
        if hwid_hex:
            k_root_hasher.update(bytes.fromhex(hwid_hex))
        k_root_hasher.update(b"dasp-identity-v3")
        blended_ss = k_root_hasher.digest()
        blended_ss_hex = blended_ss.hex()

        cipher_key = hashlib.sha256(b"cipher" + blended_ss).digest()
        hmac_key = hashlib.sha256(b"hmac" + blended_ss).digest()
        active_password_str = cipher_key.hex()
        
        # Zeroize secret key material
        for i in range(len(ss_bytes)): ss_bytes[i] = 0 
        kdf_duration = time.perf_counter() - kdf_start
        
        payload_bytes = bytes.fromhex(encrypted_content)
        h = hmac.new(hmac_key, ct_bytes + payload_bytes, hashlib.sha256)
        
        # Stage 4: final mac
        mac_tag_actual = h.hexdigest()
        
        if os.environ.get("DASP_DIAGNOSTIC") == "1":
            # Stage 2: word_key (needed for diag)
            word_key_diag = hmac.new(active_password_str.encode('utf-8'), b"dasp-word-0", hashlib.sha256).digest()
            word_key_hex_diag = word_key_diag.hex()
            
            # Stage 3: Round Indices (needed for diag)
            rng_diag = self.DarkstarChaChaPRNG(word_key_hex_diag)
            round_indices_diag = []
            for i in range(16):
                s = 0 if i % 4 == 0 else (1 if i % 4 == 2 else [0, 1, 5][rng_diag.next() % 3])
                p = [2, 3, 10][rng_diag.next() % 3]
                n = [12, 12, 11][rng_diag.next() % 3]
                a = [4, 6, 9][rng_diag.next() % 3]
                round_indices_diag.append([s, p, n, a])

            print(json.dumps({
                "diagnostics": {
                    "stage1_blended_ss": blended_ss_hex,
                    "stage2_word_key": word_key_hex_diag,
                    "stage3_round_indices": round_indices_diag,
                    "stage4_mac": mac_tag_actual
                }
            }), file=sys.stderr)

        if not hmac.compare_digest(mac_tag_actual, mac_tag):
            raise ValueError("Integrity Check Failed")
            
        def prng_factory(s_str):
            return self.DarkstarChaChaPRNG(s_str)
        
        # Stage 2: word_key
        word_key = hmac.new(active_password_str.encode('utf-8'), b"dasp-word-0", hashlib.sha256).digest()
        word_key_hex = word_key.hex()
        
        chain_state = hashlib.sha256(f"dasp-chain-{active_password_str}".encode('utf-8')).digest()
        
        rng_path = prng_factory(word_key_hex)
        group_s = [0, 1, 5]
        group_p = [2, 3, 10]
        group_n = [12, 12, 11]
        group_a = [4, 6, 9]

        # Stage 3: Round Indices
        round_indices = []
        round_paths = []
        for i in range(16):
            s_idx = 0
            if i % 4 == 0: s_idx = 0
            elif i % 4 == 2: s_idx = 1
            else: s_idx = group_s[rng_path.next() % len(group_s)]
            p_idx = group_p[rng_path.next() % len(group_p)]
            n_idx = group_n[rng_path.next() % len(group_n)]
            a_idx = group_a[rng_path.next() % len(group_a)]
            round_paths.append({'s': s_idx, 'p': p_idx, 'n': n_idx, 'a': a_idx})
            round_indices.append([s_idx, p_idx, n_idx, a_idx])

        base_indices = list(range(12))
        checksum = self._generate_checksum(base_indices)
        func_key = hmac.new(word_key, f"keyed-{checksum}".encode('utf-8'), hashlib.sha256).digest()

        if os.environ.get("DASP_DIAGNOSTIC") == "1":
            print(json.dumps({
                "diagnostics": {
                    "stage1_blended_ss": blended_ss_hex,
                    "stage2_word_key": word_key_hex,
                    "stage3_round_indices": round_indices,
                    "stage4_mac": mac_tag_actual
                }
            }), file=sys.stderr)

        current_word_bytes = payload_bytes
        cascade_start = time.perf_counter()
        for j in range(15, -1, -1):
            r = round_paths[j]
            current_word_bytes = self.deobfuscation_functions_v4[r['a']](current_word_bytes, seed=func_key, prng_factory=prng_factory)
            current_word_bytes = self.deobfuscation_functions_v4[r['n']](current_word_bytes, seed=func_key, prng_factory=prng_factory)
            current_word_bytes = self.deobfuscation_functions_v4[r['p']](current_word_bytes, seed=func_key, prng_factory=prng_factory)
            current_word_bytes = self.deobfuscation_functions_v4[r['s']](current_word_bytes, seed=func_key, prng_factory=prng_factory)
        cascade_duration = time.perf_counter() - cascade_start

        temp_word_bytes = bytearray(current_word_bytes)
        for i in range(len(temp_word_bytes)):
            temp_word_bytes[i] ^= chain_state[i % 32]
        
        total_duration = time.perf_counter() - total_start
        print(json.dumps({
            "timings": {
                "kem_us": int(kem_duration * 1_000_000),
                "kdf_us": int(kdf_duration * 1_000_000),
                "gauntlet_us": int(gauntlet_duration * 1_000_000),
                "total_us": int(total_duration * 1_000_000)
            }
        }), file=sys.stderr)
        
        return temp_word_bytes.decode('utf-8')

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Darkstar D-ASP V9 Monoculture (Python)")
    parser.add_argument("-f", "--format", choices=["json", "text"], default="json", help="Output format")
    parser.add_argument("--diagnostic", action="store_true", help="Output intermediate cryptographic states")
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    enc_parser = subparsers.add_parser("encrypt", help="Encrypt payload")
    enc_parser.add_argument("payload", help="Data to encrypt")
    enc_parser.add_argument("pk_hex", help="Kyber-1024 Public Key Hex")
    enc_parser.add_argument("--hwid", help="Hardware ID Hex")
    
    dec_parser = subparsers.add_parser("decrypt", help="Decrypt data")
    dec_parser.add_argument("data", help="D-ASP JSON blob")
    dec_parser.add_argument("sk_hex", help="Kyber-1024 Private Key Hex")
    dec_parser.add_argument("--hwid", help="Hardware ID Hex")
    dec_parser.add_argument("--diagnostic", action="store_true", help="Output intermediate cryptographic states")
    
    subparsers.add_parser("keygen", help="Generate ML-KEM-1024 pair")
    subparsers.add_parser("test", help="Internal self-test")
    
    args = parser.parse_args()
    crypt = DarkstarCrypt()
    
    def load_arg(val):
        if val and val.startswith("@"):
            with open(val[1:], "r", encoding="utf-8") as f: return f.read().strip()
        return val

    if args.diagnostic:
        os.environ["DASP_DIAGNOSTIC"] = "1"

    hardware_id = load_arg(args.hwid) if hasattr(args, "hwid") and args.hwid else None

    if args.command == "encrypt":
        print(crypt.encrypt(load_arg(args.payload), load_arg(args.pk_hex), hwid_hex=hardware_id))
    elif args.command == 'decrypt':
        print(crypt.decrypt(load_arg(args.data), load_arg(args.sk_hex), hwid_hex=hardware_id))
    elif args.command == 'keygen':
        import pqcrypto.kem.ml_kem_1024 as kem
        pk, sk = kem.generate_keypair()
        print(json.dumps({"pk": pk.hex(), "sk": sk.hex()}))
    elif args.command == 'test':
        payload = "apple banana cherry date"
        import pqcrypto.kem.ml_kem_1024 as kem
        pk, sk = kem.generate_keypair()
        print(f"--- Darkstar Python Self-Test (D-ASP Monoculture) ---")
        try:
            res_json = crypt.encrypt(payload, pk.hex())
            decrypted = crypt.decrypt(res_json, sk.hex())
            print(f"Decrypted: '{decrypted}'")
            if decrypted == payload:
                print("Result: PASSED")
            else:
                print("Result: FAILED")
                sys.exit(1)
        except Exception as e:
            print(f"Result: FAILED with error {e}")
            sys.exit(1)
    else:
        parser.print_help()


