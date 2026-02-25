
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
            return res / 4294967296.0

    class ChaCha20PRNG:
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

    def _encrypt_aes256_gcm(self, data_bytes, password, iterations):
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
        ciphertext = encryptor.update(data_bytes) + encryptor.finalize()
        tag = encryptor.tag
        
        salt_hex = salt.hex()
        iv_hex = iv.hex()
        cipher_b64 = base64.b64encode(ciphertext + tag).decode('ascii')
        
        if isinstance(key, bytearray):
            for i in range(len(key)): key[i] = 0
            
        return salt_hex + iv_hex + cipher_b64

    def _decrypt_aes256_gcm(self, transit_message, password, iterations):
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
            data = decryptor.update(ciphertext) + decryptor.finalize()
            
            if isinstance(key, bytearray):
                for i in range(len(key)): key[i] = 0
                
            return data
        except Exception as e:
            print(f"GCM Decryption failed: {e}")
            return None

    # --- Public API ---
    def encrypt(self, mnemonic, password, force_v2=False, force_v1=False):
        words = mnemonic.split(' ')
        obfuscated_words = []
        reverse_key = []
        
        password_bytes = self._to_bytes(password)
        
        is_v3 = not force_v2 and not force_v1 
        
        def prng_factory(s_str):
            if is_v3:
                return self.ChaCha20PRNG(s_str)
            return self.Mulberry32(s_str)
        
        for word in words:
            current_word_bytes = self._to_bytes(word)
            
            selected_functions = list(range(len(self.obfuscation_functions_v2)))
            
            seed_for_selection = password + word
            rng_sel = prng_factory(seed_for_selection)
            
            for i in range(len(selected_functions) - 1, 0, -1):
                rand = rng_sel.next()
                j = int(rand * (i + 1))
                selected_functions[i], selected_functions[j] = selected_functions[j], selected_functions[i]

            word_reverse_key = []
            
            cycle_depth = len(selected_functions)
            if is_v3:
                import hashlib
                depth_hash = hashlib.sha256(seed_for_selection.encode('utf-8')).hexdigest()
                depth_val = int(depth_hash[:4], 16)
                cycle_depth = 12 + (depth_val % 53)
            
            checksum = self._generate_checksum(selected_functions)
            checksum_str = str(checksum)
            checksum_bytes = self._to_bytes(checksum_str)
            combined_seed = password_bytes + checksum_bytes
            
            for i in range(cycle_depth):
                func_index = selected_functions[i % len(selected_functions)]
                
                if i >= 12 and func_index in [2, 3, 8, 9]:
                    func_index = (func_index + 2) % 12
                    
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
        
        if is_v3:
            encrypted_content = self._encrypt_aes256_gcm(self._to_bytes(base64_content), password, self.ITERATIONS_V2)
        else:
            encrypted_content = self._encrypt_aes256(self._to_bytes(base64_content), password, self.ITERATIONS_V2)
        
        if force_v1:
            return {
                "encryptedData": encrypted_content,
                "reverseKey": base64.b64encode(json.dumps(reverse_key).encode('utf-8')).decode('ascii')
            }
            
        result_obj = {
            "v": 3 if is_v3 else 2,
            "data": encrypted_content
        }
        
        # Compress Reverse Key
        encoded_reverse_key = self._pack_reverse_key(reverse_key, is_v3=is_v3)
        
        return {
            "encryptedData": json.dumps(result_obj, separators=(',', ':')),
            "reverseKey": encoded_reverse_key
        }

    def decrypt(self, encrypted_data_raw, reverse_key_b64, password):
        # 1. Decode Reverse Key
        try:
            # Try to decode as packed binary first (or auto-detect)
            decoded_b64 = base64.b64decode(reverse_key_b64)
            # Detect protocol version from the data header first if possible, or pass hint
            is_header_v3 = False
            if encrypted_data_raw.strip().startswith('{'):
                try:
                    parsed = json.loads(encrypted_data_raw)
                    if parsed.get('v') == 3:
                        is_header_v3 = True
                except:
                    pass

            if decoded_b64.strip().startswith(b'['):
                reverse_key = json.loads(decoded_b64)
            else:
                reverse_key = self._unpack_reverse_key(reverse_key_b64, is_v3=is_header_v3)
        except Exception:
             # Fallback
             reverse_key = self._unpack_reverse_key(reverse_key_b64, is_v3=False)

        # 2. Check header
        iterations = self.ITERATIONS_V2 
        encrypted_content = encrypted_data_raw
        is_v3 = False
        
        try:
            if encrypted_data_raw.strip().startswith('{'):
                parsed = json.loads(encrypted_data_raw)
                if parsed.get('v') == 2 and parsed.get('data'):
                    encrypted_content = parsed['data']
                elif parsed.get('v') == 3 and parsed.get('data'):
                    encrypted_content = parsed['data']
                    is_v3 = True
        except:
            pass 

        # 3. Decrypt AES
        if is_v3:
            decrypted_base64_bytes = self._decrypt_aes256_gcm(encrypted_content, password, iterations)
        else:
            decrypted_base64_bytes = self._decrypt_aes256(encrypted_content, password, iterations)
        
        if not decrypted_base64_bytes:
            raise ValueError("AES decryption failed Check password")

        # 4. Decode the Base64 Blob
        try:
            binary_string = base64.b64decode(decrypted_base64_bytes)
        except:
             raise ValueError("Failed to decode inner base64 blob")
             
        full_blob = binary_string
        
        deobfuscated_words = []
        password_bytes = self._to_bytes(password)
        
        def prng_factory(s_str):
            if is_v3:
                return self.ChaCha20PRNG(s_str)
            return self.Mulberry32(s_str)
        
        offset = 0
        word_index = 0
        
        while offset < len(full_blob):
            if word_index >= len(reverse_key): break
            
            length = (full_blob[offset] << 8) | full_blob[offset + 1]
            offset += 2
            
            current_word_bytes = full_blob[offset : offset + length]
            offset += length
            
            word_reverse_list = reverse_key[word_index]
            
            # Setup Seed (only core first 12 cycles determine checksum)
            unique_set = list(dict.fromkeys(word_reverse_list[:12]))
            checksum = self._generate_checksum(unique_set)
            
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

    # --- Compression Helpers ---
    def _pack_reverse_key(self, reverse_key, is_v3=True):
        buffer = bytearray()
        for word_key in reverse_key:
            if is_v3:
                buffer.append(len(word_key))
            for i in range(0, len(word_key), 2):
                high = word_key[i] & 0x0F
                low = word_key[i+1] & 0x0F if i+1 < len(word_key) else 0x00
                buffer.append((high << 4) | low)
        
        return base64.b64encode(buffer).decode('ascii')

    def _unpack_reverse_key(self, b64, is_v3=True):
        buffer = base64.b64decode(b64)
        reverse_key = []
        
        offset = 0
        while offset < len(buffer):
            word_len = 12 # Legacy V2
            if is_v3:
                word_len = buffer[offset]
                offset += 1
            
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
    import sys
    args = sys.argv[1:]
    if not args:
        print("Usage: python darkstar_crypt.py [--v3|--v2|--v1] <encrypt|decrypt|test> ...")
        sys.exit(0)

    force_v2 = False
    force_v1 = False
    if args[0] == '--v2':
        force_v2 = True
        args = args[1:]
    elif args[0] == '--v1':
        force_v1 = True
        args = args[1:]
    elif args[0] == '--v3':
        args = args[1:]
        
    if not args:
        print("Usage: python darkstar_crypt.py [--v3|--v2|--v1] <encrypt|decrypt|test> ...")
        sys.exit(0)

    command = args[0]
    crypt = DarkstarCrypt()

    if command == 'encrypt':
        if len(args) < 3:
            print("Usage: [flags] encrypt <mnemonic> <password>")
            sys.exit(1)
        res = crypt.encrypt(args[1], args[2], force_v2=force_v2, force_v1=force_v1)
        print(json.dumps(res))
    elif command == 'decrypt':
        if len(args) < 4:
            print("Usage: [flags] decrypt <data> <rk> <password>")
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
