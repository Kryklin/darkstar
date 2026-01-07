
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
    DarkstarCrypt - Advanced Encryption Implementation
    
    This class implements the V2 Darkstar encryption schema.
    """

    # --- PRNG ---
    class Mulberry32:
        def __init__(self, seed_str):
            self.state = self._seed(seed_str)

        def _seed(self, seed_str):
            h = 0
            for char in seed_str:
                code = ord(char)
                # Math.imul(h ^ code, 3432918353)
                h = (h ^ code) & 0xFFFFFFFF
                h = (h * 3432918353) & 0xFFFFFFFF
                
                # h = (h << 13) | (h >>> 19)
                h = ((h << 13) & 0xFFFFFFFF) | (h >> 19)
            
            # Initial mixing
            # Math.imul(h ^ (h >>> 16), 2246822507)
            h = (h ^ (h >> 16)) & 0xFFFFFFFF
            h = (h * 2246822507) & 0xFFFFFFFF
            
            # Math.imul(h ^ (h >>> 13), 3266489909)
            h = (h ^ (h >> 13)) & 0xFFFFFFFF
            h = (h * 3266489909) & 0xFFFFFFFF
            
            # h ^= h >>> 16
            h = (h ^ (h >> 16)) & 0xFFFFFFFF
            return h

        def next(self):
            # state = (state + 0x6d2b79f5) | 0
            self.state = (self.state + 0x6d2b79f5) & 0xFFFFFFFF
            
            # t = Math.imul(state ^ (state >>> 15), 1 | state)
            t = (self.state ^ (self.state >> 15)) & 0xFFFFFFFF
            t = (t * (1 | self.state)) & 0xFFFFFFFF
            
            # t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            term2 = (t ^ (t >> 7)) & 0xFFFFFFFF
            term2 = (term2 * (61 | t)) & 0xFFFFFFFF
            t = ((t + term2) & 0xFFFFFFFF) ^ t
            
            # ((t ^ (t >>> 14)) >>> 0) / 4294967296
            res = (t ^ (t >> 14)) & 0xFFFFFFFF
            return res / 4294967296.0

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
            j = int(rand * (i + 1))
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
            j = int(rand * (i + 1))
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
            rand_idx = int(rng.next() * len(random_chars))
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
        block_size = int(rng.next() * (len(data) / 2)) + 2
        
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
            j = int(rand * (i + 1))
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
            j = int(rand * (i + 1))
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
        
        # Best effort zeroing
        if isinstance(key, bytearray):
            for i in range(len(key)): key[i] = 0
            
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
            
            # Best effort zeroing
            if isinstance(key, bytearray):
                for i in range(len(key)): key[i] = 0
                
            return data
        except Exception as e:
            print(f"Decryption failed: {e}")
            return None

    # --- Public API ---
    def encrypt(self, mnemonic, password):
        words = mnemonic.split(' ')
        obfuscated_words = []
        reverse_key = []
        
        password_bytes = self._to_bytes(password)
        
        def prng_factory(s_str):
            mul = self.Mulberry32(s_str)
            return mul # has .next()
        
        for word in words:
            current_word_bytes = self._to_bytes(word)
            
            # Select functions
            # Dynamic function shuffle based on seed
            selected_functions = list(range(len(self.obfuscation_functions_v2)))
            
            # Use Mulberry32 for shuffling selection
            seed_for_selection = password + word
            rng_sel = self.Mulberry32(seed_for_selection)
            
            for i in range(len(selected_functions) - 1, 0, -1):
                rand = rng_sel.next()
                j = int(rand * (i + 1))
                selected_functions[i], selected_functions[j] = selected_functions[j], selected_functions[i]

            word_reverse_key = []
            
            # Checksum
            checksum = self._generate_checksum(selected_functions)
            checksum_str = str(checksum)
            checksum_bytes = self._to_bytes(checksum_str)
            combined_seed = password_bytes + checksum_bytes
            
            for func_index in selected_functions:
                func = self.obfuscation_functions_v2[func_index]
                is_seeded = func_index >= 6
                seed = combined_seed if is_seeded else None
                
                # Execute
                if is_seeded:
                    current_word_bytes = func(current_word_bytes, seed=seed, prng_factory=prng_factory)
                else:
                    current_word_bytes = func(current_word_bytes)
                
                word_reverse_key.append(func_index)
                
            obfuscated_words.append(current_word_bytes)
            reverse_key.append(word_reverse_key)
            
        # Join words in V2 Blob format [Size-High, Size-Low, Data...]
        final_blob = bytearray()
        for wb in obfuscated_words:
            length = len(wb)
            final_blob.append((length >> 8) & 0xFF)
            final_blob.append(length & 0xFF)
            final_blob.extend(wb)
            
        # Base64 encode final blob for AES
        # JS: const base64Content = btoa(binaryString);
        # Python:
        base64_content = base64.b64encode(final_blob).decode('ascii')
        
        # AES Encrypt
        encrypted_content = self._encrypt_aes256(self._to_bytes(base64_content), password, self.ITERATIONS_V2)
        
        result_obj = {
            "v": 2,
            "data": encrypted_content
        }
        
        reverse_key_json = json.dumps(reverse_key, separators=(',', ':'))
        encoded_reverse_key = base64.b64encode(self._to_bytes(reverse_key_json)).decode('ascii')
        
        return {
            "encryptedData": json.dumps(result_obj, separators=(',', ':')),
            "reverseKey": encoded_reverse_key
        }

    def decrypt(self, encrypted_data_raw, reverse_key_b64, password):
        # 1. Decode Reverse Key
        try:
            reverse_key_json_bytes = base64.b64decode(reverse_key_b64)
            reverse_key = json.loads(reverse_key_json_bytes)
        except:
            raise ValueError("Invalid reverse key")

        # 2. Check header
        iterations = self.ITERATIONS_V2 # Default V2
        encrypted_content = encrypted_data_raw
        
        try:
            if encrypted_data_raw.strip().startswith('{'):
                parsed = json.loads(encrypted_data_raw)
                if parsed.get('v') == 2 and parsed.get('data'):
                    encrypted_content = parsed['data']
        except:
            pass # Assume legacy if fail, but this script only supports V2 for now (or matches JS logic)

        # 3. Decrypt AES
        # AES returns bytes
        decrypted_base64_bytes = self._decrypt_aes256(encrypted_content, password, iterations)
        
        if not decrypted_base64_bytes:
            raise ValueError("AES decryption failed Check password")

        # 4. Decode the Base64 Blob
        try:
            binary_string = base64.b64decode(decrypted_base64_bytes) # This is the "finalBlob"
        except:
             # Maybe it was legacy string?
             raise ValueError("Failed to decode inner base64 blob")
             
        full_blob = binary_string
        
        deobfuscated_words = []
        password_bytes = self._to_bytes(password)
        
        def prng_factory(s_str):
            return self.Mulberry32(s_str)
        
        offset = 0
        word_index = 0
        
        while offset < len(full_blob):
            if word_index >= len(reverse_key): break
            
            # Read Length
            length = (full_blob[offset] << 8) | full_blob[offset + 1]
            offset += 2
            
            current_word_bytes = full_blob[offset : offset + length]
            offset += length
            
            word_reverse_list = reverse_key[word_index]
            
            # Setup Seed
            checksum = self._generate_checksum(word_reverse_list)
            checksum_str = str(checksum)
            checksum_bytes = self._to_bytes(checksum_str)
            combined_seed = password_bytes + checksum_bytes
            
            # Apply Deobfuscation (Reverse Order)
            for j in range(len(word_reverse_list) - 1, -1, -1):
                func_index = word_reverse_list[j]
                func = self.deobfuscation_functions_v2[func_index]
                
                is_seeded = func_index >= 6
                seed = combined_seed if is_seeded else None
                
                if is_seeded:
                    current_word_bytes = func(current_word_bytes, seed=seed, prng_factory=prng_factory)
                else:
                    current_word_bytes = func(current_word_bytes)
                    
            deobfuscated_words.append(self._bytes_to_string(current_word_bytes))
            word_index += 1
            
        return " ".join(deobfuscated_words)

if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    if not args:
        print("Usage: python darkstar_crypt.py <encrypt|decrypt|test> ...")
        sys.exit(0)

    command = args[0]
    crypt = DarkstarCrypt()

    if command == 'encrypt':
        if len(args) < 3:
            print("Usage: encrypt <mnemonic> <password>")
            sys.exit(1)
        res = crypt.encrypt(args[1], args[2])
        print(json.dumps(res))
    elif command == 'decrypt':
        if len(args) < 4:
            print("Usage: decrypt <data> <rk> <password>")
            sys.exit(1)
        res = crypt.decrypt(args[1], args[2], args[3])
        print(res)
    elif command == 'test':
        mnemonic = "cat dog fish bird"
        password = "MySecre!Password123"
        print(f"--- Darkstar Python Self-Test ---")
        res = crypt.encrypt(mnemonic, password)
        decrypted = crypt.decrypt(res['encryptedData'], res['reverseKey'], password)
        print(f"Decrypted: '{decrypted}'")
        if decrypted == mnemonic:
            print("Result: PASSED")
        else:
            print("Result: FAILED")
            sys.exit(1)
    else:
        print(f"Unknown command: {command}")
