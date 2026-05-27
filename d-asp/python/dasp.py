"""
D-ASP (ASP Cascade 16)
Implementation: Python (Reference)

To the extent possible under law, the author(s) have dedicated all copyright 
and related and neighboring rights to this software to the public domain 
worldwide. This software is distributed without any warranty.

See <http://creativecommons.org/publicdomain/zero/1.0/>
"""

import os
import sys
import json
import struct
import hashlib
import hmac
import time
try:
    import pqcrypto.kem.ml_kem_1024 as kem
except ImportError:
    kem = None

class DarkstarCrypt:
    class DarkstarChaChaPRNG:
        def __init__(self, seed_str):
            self.hash = hashlib.sha512(seed_str.encode('utf-8')).digest()
            self.state = [0]*16
            self.state[0] = 0x61707865
            self.state[1] = 0x3320646e
            self.state[2] = 0x79622d32
            self.state[3] = 0x6b206574
            for i in range(8):
                self.state[4+i] = struct.unpack('<I', self.hash[i*4:(i+1)*4])[0]
            self.state[12] = 0 
            self.state[13] = 0 
            self.state[14] = 0 
            self.state[15] = 0 
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

    def _dasp_cascade_32(self, block: bytearray, round_keys: list):
        # 32-byte block = 8x uint32 words
        state = list(struct.unpack('<8I', block))
        
        def rotate(v, n): return ((v << n) & 0xFFFFFFFF) | (v >> (32 - n))

        def dasp_round(i):
            rk = round_keys[i*8:(i+1)*8]
            for j in range(8):
                state[j] = (state[j] + rk[j]) & 0xFFFFFFFF
            rc = (0x9E3779B9 + i) & 0xFFFFFFFF
            for j in range(8):
                state[j] ^= rc
            for j in range(8):
                state[j] = rotate(state[j], 11)
            
            # Permutation: [0, 7, 6, 5, 4, 3, 2, 1] means
            # state[0] gets old state[1]
            # state[1] gets old state[2]
            # ... state[7] gets old state[0]
            t = state[0]
            state[0] = state[1]
            state[1] = state[2]
            state[2] = state[3]
            state[3] = state[4]
            state[4] = state[5]
            state[5] = state[6]
            state[6] = state[7]
            state[7] = t
            
        for r in range(16):
            dasp_round(r)
            
        block[:] = struct.pack('<8I', *state)

    def encrypt(self, payload_str, pk_hex, hwid_hex=None):
        total_start = time.perf_counter()
        
        pk_bytes = bytes.fromhex(pk_hex)
        kem_start = time.perf_counter()
        ct_bytes, ss_bytes_tup = kem.encrypt(pk_bytes)
        kem_duration = time.perf_counter() - kem_start
        
        ss_bytes = bytearray(ss_bytes_tup)
        ct_hex = ct_bytes.hex()
        
        kdf_start = time.perf_counter()
        salt = bytes.fromhex(hwid_hex) if hwid_hex else b'\x00' * 32
        prk = hmac.new(salt, bytes(ss_bytes), hashlib.sha256).digest()
        blended_ss = hmac.new(prk, b"dasp-identity-v3\x01", hashlib.sha256).digest()
        blended_ss_hex = blended_ss.hex()

        cipher_key = hashlib.sha256(b"cipher" + blended_ss).digest()
        hmac_key = hashlib.sha256(b"hmac" + blended_ss).digest()
        active_password_str = cipher_key.hex()
        
        for i in range(len(ss_bytes)): ss_bytes[i] = 0 
        kdf_duration = time.perf_counter() - kdf_start
        
        word_key = hmac.new(active_password_str.encode('utf-8'), b"dasp-word-0", hashlib.sha256).digest()
        word_key_hex = word_key.hex()
        
        chain_state = bytearray(hashlib.sha256(f"dasp-chain-{active_password_str}".encode('utf-8')).digest())
        
        rng = self.DarkstarChaChaPRNG(word_key_hex)
        round_keys = [rng.next() for _ in range(128)]

        payload_bytes = bytearray(payload_str.encode('utf-8'))
        cascade_start = time.perf_counter()
        
        # CTR Mode
        nonce = chain_state
        for i in range(0, len(payload_bytes), 32):
            chunk_len = min(32, len(payload_bytes) - i)
            block = bytearray(nonce)
            self._dasp_cascade_32(block, round_keys)
            for j in range(chunk_len):
                payload_bytes[i+j] ^= block[j]
            
            # Increment nonce
            for j in range(32):
                nonce[j] = (nonce[j] + 1) & 0xFF
                if nonce[j] != 0: break

        cascade_duration = time.perf_counter() - cascade_start
        
        h = hmac.new(hmac_key, ct_bytes + payload_bytes, hashlib.sha256)
        mac_tag = h.hexdigest()
        
        if os.environ.get("DASP_DIAGNOSTIC") == "1":
            print(json.dumps({
                "diagnostics": {
                    "stage1_blended_ss": blended_ss_hex,
                    "stage2_word_key": word_key_hex,
                    "stage4_mac": mac_tag
                }
            }), file=sys.stderr)

        total_duration = time.perf_counter() - total_start
        return json.dumps({
            "data": payload_bytes.hex(),
            "ct": ct_hex,
            "mac": mac_tag,
            "timings": {
                "kem_us": int(kem_duration * 1_000_000),
                "kdf_us": int(kdf_duration * 1_000_000),
                "cascade_us": int(cascade_duration * 1_000_000),
                "total_us": int(total_duration * 1_000_000)
            }
        })

    def decrypt(self, encrypted_data_raw, sk_hex, hwid_hex=None):
        total_start = time.perf_counter()
        
        data = json.loads(encrypted_data_raw)
        ct_bytes = bytes.fromhex(data["ct"])
        payload_bytes = bytearray.fromhex(data["data"])
        mac_tag = data["mac"]
        
        sk_bytes = bytes.fromhex(sk_hex)
        
        kem_start = time.perf_counter()
        ss_bytes_tup = kem.decrypt(sk_bytes, ct_bytes)
        kem_duration = time.perf_counter() - kem_start
        
        ss_bytes = bytearray(ss_bytes_tup)
        
        kdf_start = time.perf_counter()
        salt = bytes.fromhex(hwid_hex) if hwid_hex else b'\x00' * 32
        prk = hmac.new(salt, bytes(ss_bytes), hashlib.sha256).digest()
        blended_ss = hmac.new(prk, b"dasp-identity-v3\x01", hashlib.sha256).digest()
        blended_ss_hex = blended_ss.hex()

        cipher_key = hashlib.sha256(b"cipher" + blended_ss).digest()
        hmac_key = hashlib.sha256(b"hmac" + blended_ss).digest()
        active_password_str = cipher_key.hex()
        
        for i in range(len(ss_bytes)): ss_bytes[i] = 0 
        kdf_duration = time.perf_counter() - kdf_start
        
        h = hmac.new(hmac_key, ct_bytes + payload_bytes, hashlib.sha256)
        mac_tag_actual = h.hexdigest()
        
        word_key = hmac.new(active_password_str.encode('utf-8'), b"dasp-word-0", hashlib.sha256).digest()
        word_key_hex = word_key.hex()

        if os.environ.get("DASP_DIAGNOSTIC") == "1":
            print(json.dumps({
                "diagnostics": {
                    "stage1_blended_ss": blended_ss_hex,
                    "stage2_word_key": word_key_hex,
                    "stage4_mac": mac_tag_actual
                }
            }), file=sys.stderr)

        if not hmac.compare_digest(mac_tag_actual, mac_tag):
            raise ValueError("Integrity Check Failed")
            
        chain_state = bytearray(hashlib.sha256(f"dasp-chain-{active_password_str}".encode('utf-8')).digest())
        
        rng = self.DarkstarChaChaPRNG(word_key_hex)
        round_keys = [rng.next() for _ in range(128)]

        cascade_start = time.perf_counter()
        
        # CTR Mode
        nonce = chain_state
        for i in range(0, len(payload_bytes), 32):
            chunk_len = min(32, len(payload_bytes) - i)
            block = bytearray(nonce)
            self._dasp_cascade_32(block, round_keys)
            for j in range(chunk_len):
                payload_bytes[i+j] ^= block[j]
            
            # Increment nonce
            for j in range(32):
                nonce[j] = (nonce[j] + 1) & 0xFF
                if nonce[j] != 0: break

        cascade_duration = time.perf_counter() - cascade_start
        
        total_duration = time.perf_counter() - total_start
        print(json.dumps({
            "timings": {
                "kem_us": int(kem_duration * 1_000_000),
                "kdf_us": int(kdf_duration * 1_000_000),
                "cascade_us": int(cascade_duration * 1_000_000),
                "total_us": int(total_duration * 1_000_000)
            }
        }), file=sys.stderr)
        
        return payload_bytes.decode('utf-8')

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
