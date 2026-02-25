use aes::Aes256;
use base64::{engine::general_purpose, Engine as _};
use cbc::cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use hmac::Hmac;
use pbkdf2::pbkdf2;
use rand::Rng;

/// Darkstar Encrypt/Decrypt
/// 
/// Implements V2 Darkstar encryption with:
/// - 12 dynamic obfuscation layers
/// - Mulberry32 PRNG
/// - AES-256-CBC with PBKDF2


use serde_json;
use sha2::Sha256;



const ITERATIONS_V2: u32 = 600_000;
const KEY_SIZE: usize = 32;
const SALT_SIZE_BYTES: usize = 16;
const IV_SIZE_BYTES: usize = 16;

// --- PRNG ---

struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    fn new(seed_str: &str) -> Self {
        let mut m = Mulberry32 { state: 0 };
        m.seed(seed_str);
        m
    }

    fn seed(&mut self, seed_str: &str) {
        let mut h: u32 = 0;
        for char in seed_str.chars() {
            let code = char as u32;
            h = (h ^ code).wrapping_mul(3432918353);
            h = (h << 13) | (h >> 19);
        }
        h = (h ^ (h >> 16)).wrapping_mul(2246822507);
        h = (h ^ (h >> 13)).wrapping_mul(3266489909);
        h ^= h >> 16;
        self.state = h;
    }

    fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let mut t = self.state ^ (self.state >> 15);
        t = t.wrapping_mul(1 | self.state);
        let term2 = (t ^ (t >> 7)).wrapping_mul(61 | t);
        t = (t.wrapping_add(term2)) ^ t;

        let res = t ^ (t >> 14);
        (res as f64) / 4294967296.0
    }
}

struct ChaCha20PRNG {
    state: [u32; 8],
    counter: u32,
}

impl ChaCha20PRNG {
    fn new(seed_str: &str) -> Self {
        use sha2::Digest;
        let hash = sha2::Sha256::digest(seed_str.as_bytes());
        let hash_hex = hex::encode(hash);
        let mut state = [0u32; 8];
        for i in 0..8 {
            let chunk = &hash_hex[i * 8..(i + 1) * 8];
            state[i] = u32::from_str_radix(chunk, 16).unwrap_or(0);
        }
        ChaCha20PRNG { state, counter: 0 }
    }

    fn next(&mut self) -> f64 {
        self.counter = self.counter.wrapping_add(1);
        let mut x = self.state[((self.counter + 0) % 8) as usize];
        let mut y = self.state[((self.counter + 3) % 8) as usize];
        let mut z = self.state[((self.counter + 5) % 8) as usize];

        x = x.wrapping_add(y).wrapping_add(self.counter);
        z = z ^ x;
        z = (z << 16) | (z >> 16);

        y = y.wrapping_add(z).wrapping_add(self.counter.wrapping_mul(3));
        x = x ^ y;
        x = (x << 12) | (x >> 20);

        self.state[((self.counter + 0) % 8) as usize] = x;
        self.state[((self.counter + 3) % 8) as usize] = y;
        self.state[((self.counter + 5) % 8) as usize] = z;

        let mut t = x.wrapping_add(y).wrapping_add(z);
        t = (t ^ (t >> 15)).wrapping_mul(1 | t);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;

        let res = t ^ (t >> 14);
        (res as f64) / 4294967296.0
    }
}

enum ActivePRNG {
    Mulberry(Mulberry32),
    ChaCha(ChaCha20PRNG),
}

impl ActivePRNG {
    fn new(seed_str: &str, is_v3: bool) -> Self {
        if is_v3 {
            ActivePRNG::ChaCha(ChaCha20PRNG::new(seed_str))
        } else {
            ActivePRNG::Mulberry(Mulberry32::new(seed_str))
        }
    }

    fn next(&mut self) -> f64 {
        match self {
            ActivePRNG::Mulberry(m) => m.next(),
            ActivePRNG::ChaCha(c) => c.next(),
        }
    }
}

use zeroize::Zeroize;

// --- DarkstarCrypt ---

type ObfuscationResult = Result<Vec<u8>, Box<dyn std::error::Error>>;
type ObfuscationFn = fn(&[u8], Option<&[u8]>, &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult;

struct DarkstarCrypt {
    obfuscation_functions_v2: Vec<ObfuscationFn>,
    deobfuscation_functions_v2: Vec<ObfuscationFn>,
}

impl DarkstarCrypt {
    fn new() -> Self {
        DarkstarCrypt {
            obfuscation_functions_v2: vec![
                Self::obfuscate_by_reversing_v2,
                Self::obfuscate_with_atbash_cipher_v2,
                Self::obfuscate_to_char_codes_v2,
                Self::obfuscate_to_binary_v2,
                Self::obfuscate_with_caesar_cipher_v2,
                Self::obfuscate_by_swapping_adjacent_bytes_v2,
                Self::obfuscate_by_shuffling_v2,
                Self::obfuscate_with_xor_v2,
                Self::obfuscate_by_interleaving_v2,
                Self::obfuscate_with_vigenere_cipher_v2,
                Self::obfuscate_with_seeded_block_reversal_v2,
                Self::obfuscate_with_seeded_substitution_v2,
            ],
            deobfuscation_functions_v2: vec![
                Self::deobfuscate_by_reversing_v2,
                Self::deobfuscate_with_atbash_cipher_v2,
                Self::deobfuscate_from_char_codes_v2,
                Self::deobfuscate_from_binary_v2,
                Self::deobfuscate_with_caesar_cipher_v2,
                Self::deobfuscate_by_swapping_adjacent_bytes_v2,
                Self::deobfuscate_by_shuffling_v2,
                Self::deobfuscate_with_xor_v2,
                Self::deobfuscate_by_deinterleaving_v2,
                Self::deobfuscate_with_vigenere_cipher_v2,
                Self::deobfuscate_with_seeded_block_reversal_v2,
                Self::deobfuscate_with_seeded_substitution_v2,
            ],
        }
    }

    // --- Helpers ---

    fn generate_checksum(numbers: &[usize]) -> usize {
        if numbers.is_empty() {
            return 0;
        }
        let sum: usize = numbers.iter().sum();
        sum % 997
    }

    // --- Obfuscation Functions (V2) ---

    fn obfuscate_by_reversing_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().rev().cloned().collect())
    }
    fn deobfuscate_by_reversing_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_by_reversing_v2(input, seed, prng_factory)
    }

    fn obfuscate_with_atbash_cipher_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| {
            if b >= 65 && b <= 90 {
                90 - (b - 65)
            } else if b >= 97 && b <= 122 {
                122 - (b - 97)
            } else {
                b
            }
        }).collect())
    }
    fn deobfuscate_with_atbash_cipher_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_with_atbash_cipher_v2(input, seed, prng_factory)
    }

    fn obfuscate_to_char_codes_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut parts = Vec::new();
        for (i, &b) in input.iter().enumerate() {
            if i > 0 {
                parts.push(44); // comma
            }
            let str_val = b.to_string();
            parts.extend_from_slice(str_val.as_bytes());
        }
        Ok(parts)
    }

    fn deobfuscate_from_char_codes_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let s = String::from_utf8(input.to_vec())?;
        if s.is_empty() { return Ok(Vec::new()); }
        let res = s.split(',')
            .filter(|p| !p.is_empty())
            .map(|p| p.parse::<u8>().map_err(|e| e.into()))
            .collect::<Result<Vec<u8>, Box<dyn std::error::Error>>>()?;
        Ok(res)
    }

    fn obfuscate_to_binary_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut parts = Vec::new();
        for (i, &b) in input.iter().enumerate() {
            if i > 0 {
                parts.push(44);
            }
            let str_val = format!("{:b}", b);
            parts.extend_from_slice(str_val.as_bytes());
        }
        Ok(parts)
    }

    fn deobfuscate_from_binary_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let s = String::from_utf8(input.to_vec())?;
        if s.is_empty() { return Ok(Vec::new()); }
        let res = s.split(',')
            .filter(|p| !p.is_empty())
            .map(|p| u8::from_str_radix(p, 2).map_err(|e| e.into()))
            .collect::<Result<Vec<u8>, Box<dyn std::error::Error>>>()?;
        Ok(res)
    }

    fn obfuscate_with_caesar_cipher_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| {
            if b >= 65 && b <= 90 {
                ((b - 65 + 13) % 26) + 65
            } else if b >= 97 && b <= 122 {
                ((b - 97 + 13) % 26) + 97
            } else {
                b
            }
        }).collect())
    }
    fn deobfuscate_with_caesar_cipher_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_with_caesar_cipher_v2(input, seed, prng_factory)
    }

    fn obfuscate_by_swapping_adjacent_bytes_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut output = input.to_vec();
        for i in (0..output.len().saturating_sub(1)).step_by(2) {
            output.swap(i, i + 1);
        }
        Ok(output)
    }
    fn deobfuscate_by_swapping_adjacent_bytes_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_by_swapping_adjacent_bytes_v2(input, seed, prng_factory)
    }

    fn obfuscate_by_shuffling_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut output = input.to_vec();
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        for i in (1..output.len()).rev() {
            let j = (rng.next() * (i + 1) as f64) as usize;
            output.swap(i, j);
        }
        Ok(output)
    }

    fn deobfuscate_by_shuffling_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let n = input.len();
        let mut indices: Vec<usize> = (0..n).collect();
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        for i in (1..n).rev() {
            let j = (rng.next() * (i + 1) as f64) as usize;
            indices.swap(i, j);
        }
        let mut output = vec![0u8; n];
        for i in 0..n {
            output[indices[i]] = input[i];
        }
        Ok(output)
    }

    fn obfuscate_with_xor_v2(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| b ^ seed[i % seed.len()]).collect())
    }
    fn deobfuscate_with_xor_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_with_xor_v2(input, seed, prng_factory)
    }

    fn obfuscate_by_interleaving_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let random_chars = b"abcdefghijklmnopqrstuvwxyz0123456789";
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        let mut output = Vec::with_capacity(input.len() * 2);
        for &b in input {
            output.push(b);
            let rand_idx = (rng.next() * random_chars.len() as f64) as usize;
            output.push(random_chars[rand_idx]);
        }
        Ok(output)
    }

    fn deobfuscate_by_deinterleaving_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().step_by(2).cloned().collect())
    }

    fn obfuscate_with_vigenere_cipher_v2(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        let mut parts = Vec::new();
        for (i, &b) in input.iter().enumerate() {
            if i > 0 {
                parts.push(44);
            }
            let key_code = seed[i % seed.len()];
            let val = (b as u16) + (key_code as u16);
            let val_str = val.to_string();
            parts.extend_from_slice(val_str.as_bytes());
        }
        Ok(parts)
    }

    fn deobfuscate_with_vigenere_cipher_v2(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let seed = seed.unwrap_or(&[]);
        let s = String::from_utf8(input.to_vec())?;
        if s.is_empty() { return Ok(Vec::new()); }
        let res = s.split(',')
            .enumerate()
            .map(|(i, p)| {
                if p.is_empty() { return Ok(0u8); }
                let val: u16 = p.parse()?;
                let key_code = seed[i % seed.len()] as u16;
                Ok((val - key_code) as u8)
            })
            .collect::<Result<Vec<u8>, Box<dyn std::error::Error>>>()?;
        Ok(res)
    }

    fn obfuscate_with_seeded_block_reversal_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        let block_size = (rng.next() * (input.len() / 2) as f64) as usize + 2;
        let mut output = input.to_vec();
        for chunk in output.chunks_mut(block_size) {
            chunk.reverse();
        }
        Ok(output)
    }
    fn deobfuscate_with_seeded_block_reversal_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_with_seeded_block_reversal_v2(input, seed, prng_factory)
    }

    fn obfuscate_with_seeded_substitution_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut chars: Vec<u8> = (0..=255).collect();
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        for i in (1..=255).rev() {
            let j = (rng.next() * (i + 1) as f64) as usize;
            chars.swap(i, j);
        }
        Ok(input.iter().map(|&b| chars[b as usize]).collect())
    }

    fn deobfuscate_with_seeded_substitution_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut chars: Vec<u8> = (0..=255).collect();
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        for i in (1..=255).rev() {
            let j = (rng.next() * (i + 1) as f64) as usize;
            chars.swap(i, j);
        }
        let mut unsub_map = vec![0u8; 256];
        for (i, &c) in chars.iter().enumerate() {
            unsub_map[c as usize] = i as u8;
        }
        Ok(input.iter().map(|&b| unsub_map[b as usize]).collect())
    }

    // --- Compression Helpers ---

    fn pack_reverse_key(reverse_key: &Vec<Vec<usize>>, is_v3: bool) -> Result<String, Box<dyn std::error::Error>> {
        let mut buffer = Vec::new();
        for word_key in reverse_key {
            if is_v3 {
                buffer.push(word_key.len() as u8);
            }
            for chunk in word_key.chunks(2) {
                let high = (chunk[0] & 0x0F) as u8;
                let low = if chunk.len() > 1 { (chunk[1] & 0x0F) as u8 } else { 0 };
                buffer.push((high << 4) | low);
            }
        }
        Ok(general_purpose::STANDARD.encode(&buffer))
    }

    fn unpack_reverse_key(b64: &str, is_v3: bool) -> Result<Vec<Vec<usize>>, Box<dyn std::error::Error>> {
        let bytes = general_purpose::STANDARD.decode(b64)?;
        let mut reverse_key = Vec::new();
        
        let mut offset = 0;
        while offset < bytes.len() {
            let word_len = if is_v3 {
                let l = bytes[offset] as usize;
                offset += 1;
                l
            } else {
                12 // Legacy V2 default
            };
            
            let num_bytes_to_read = (word_len + 1) / 2;
            let mut word_key = Vec::new();
            
            for _ in 0..num_bytes_to_read {
                if offset >= bytes.len() { break; }
                let b = bytes[offset];
                offset += 1;
                
                let high = ((b >> 4) & 0x0F) as usize;
                let low = (b & 0x0F) as usize;
                word_key.push(high);
                if word_key.len() < word_len {
                    word_key.push(low);
                }
            }
            reverse_key.push(word_key);
        }
        Ok(reverse_key)
    }

    fn encrypt(&self, mnemonic: &str, password: &str, force_v2: bool, force_v1: bool) -> Result<String, Box<dyn std::error::Error>> {
        let words: Vec<&str> = mnemonic.split(' ').collect();
        let mut obfuscated_words = Vec::new();
        let mut reverse_key = Vec::new();

        let password_bytes = password.as_bytes();
        let is_v3 = !force_v2 && !force_v1; 
        
        let prng_factory = |s: &str| ActivePRNG::new(s, is_v3);

        for word in words {
            let mut current_word_bytes = word.as_bytes().to_vec();

            let mut selected_functions: Vec<usize> = (0..12).collect();
            let seed_for_selection = format!("{}{}", password, word);
            let mut rng_sel = prng_factory(&seed_for_selection);
            
            for i in (1..12).rev() {
                let j = (rng_sel.next() * (i + 1) as f64) as usize;
                selected_functions.swap(i, j);
            }

            let mut cycle_depth = selected_functions.len();
            if is_v3 {
                use sha2::Digest;
                let hash = sha2::Sha256::digest(seed_for_selection.as_bytes());
                let hash_hex = hex::encode(hash);
                if let Ok(depth_val) = usize::from_str_radix(&hash_hex[..4], 16) {
                    cycle_depth = 12 + (depth_val % 53);
                }
            }

            let checksum = Self::generate_checksum(&selected_functions);
            let checksum_bytes = checksum.to_string().into_bytes();
            let combined_seed = [password_bytes, &checksum_bytes].concat();

            let mut word_reverse_key = Vec::new();

            for i in 0..cycle_depth {
                let mut func_index = selected_functions[i % selected_functions.len()];

                if i >= 12 && (func_index == 2 || func_index == 3 || func_index == 8 || func_index == 9) {
                    func_index = (func_index + 2) % 12;
                }

                let is_seeded = func_index >= 6;
                let seed = if is_seeded { Some(combined_seed.as_slice()) } else { None };

                let func = self.obfuscation_functions_v2[func_index];
                current_word_bytes = func(&current_word_bytes, seed, &prng_factory)?;
                word_reverse_key.push(func_index);
            }
            obfuscated_words.push(current_word_bytes);
            reverse_key.push(word_reverse_key);
        }

        // Final Blob
        let mut final_blob = Vec::new();
        for wb in &obfuscated_words {
            let l = wb.len();
            final_blob.push(((l >> 8) & 0xff) as u8);
            final_blob.push((l & 0xff) as u8);
            final_blob.extend(wb);
        }

        let base64_content = general_purpose::STANDARD.encode(&final_blob);
        
        let encrypted_content = if is_v3 {
            self.encrypt_aes256_gcm(&base64_content, password, ITERATIONS_V2)?
        } else {
            self.encrypt_aes256(&base64_content, password, ITERATIONS_V2)?
        };

        if force_v1 {
            let uncompressed_rk = serde_json::to_string(&reverse_key)?;
            let b64_rk = general_purpose::STANDARD.encode(&uncompressed_rk);
            
            let final_json = serde_json::to_string(&serde_json::json!({
                "encryptedData": encrypted_content,
                "reverseKey": b64_rk
            }))?;
            return Ok(final_json);
        }

        // Packed Binary Reverse Key
        let encoded_reverse_key = Self::pack_reverse_key(&reverse_key, is_v3)?;

        let result_obj = serde_json::json!({
            "v": if is_v3 { 3 } else { 2 },
            "data": encrypted_content
        });

        let final_json = serde_json::to_string(&serde_json::json!({
            "encryptedData": result_obj.to_string(),
            "reverseKey": encoded_reverse_key
        }))?;

        Ok(final_json)
    }

    /// Decrypts the encrypted data back to the original mnemonic.
    fn decrypt(&self, encrypted_data_raw: &str, reverse_key_b64: &str, password: &str) -> Result<String, Box<dyn std::error::Error>> {
        // 1. Decode Reverse Key (Auto-detect Legacy JSON vs Packed Binary)
        let mut is_v3 = false;
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(encrypted_data_raw) {
            if value["v"] == 3 {
                is_v3 = true;
            }
        }

        let reverse_key: Vec<Vec<usize>> = if let Ok(bytes) = general_purpose::STANDARD.decode(reverse_key_b64) {
            if let Ok(rk) = serde_json::from_slice::<Vec<Vec<usize>>>(&bytes) {
                rk
            } else {
                Self::unpack_reverse_key(reverse_key_b64, is_v3)?
            }
        } else {
             return Err("Invalid base64 in reverse key".into());
        };

        let mut encrypted_content = String::new();
        
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(encrypted_data_raw) {
            if value["v"] == 2 {
                if let Some(data) = value["data"].as_str() {
                    encrypted_content = data.to_string();
                }
            } else if value["v"] == 3 {
                if let Some(data) = value["data"].as_str() {
                    encrypted_content = data.to_string();
                }
            }
        }
        if encrypted_content.is_empty() {
            encrypted_content = encrypted_data_raw.to_string();
        }

        let decrypted_base64_bytes = if is_v3 {
            self.decrypt_aes256_gcm(&encrypted_content, password, ITERATIONS_V2)?
        } else {
            self.decrypt_aes256(&encrypted_content, password, ITERATIONS_V2)?
        };
        let binary_string = String::from_utf8(decrypted_base64_bytes)?;
        let full_blob = general_purpose::STANDARD.decode(binary_string)?;

        let mut deobfuscated_words = Vec::new();
        let password_bytes = password.as_bytes();
        let prng_factory = |s: &str| ActivePRNG::new(s, is_v3);

        let mut offset = 0;
        let mut word_index = 0;

        while offset < full_blob.len() {
            if word_index >= reverse_key.len() { break; }
            if offset + 2 > full_blob.len() { break; }

            let length = ((full_blob[offset] as usize) << 8) | (full_blob[offset + 1] as usize);
            offset += 2;
            if offset + length > full_blob.len() { break; }

            let mut current_word_bytes = full_blob[offset..offset+length].to_vec();
            offset += length;

            let word_reverse_list = &reverse_key[word_index];
            
            let mut unique_set = Vec::new();
            // Core checksum only depends on first 12 cycles
            for &f in word_reverse_list.iter().take(12) {
                if !unique_set.contains(&f) { unique_set.push(f); }
            }
            let checksum = Self::generate_checksum(&unique_set);
            
            let checksum_bytes = checksum.to_string().into_bytes();
            let combined_seed = [password_bytes, &checksum_bytes].concat();

            for &func_index in word_reverse_list.iter().rev() {
                let func = self.deobfuscation_functions_v2[func_index];
                let is_seeded = func_index >= 6;
                let seed = if is_seeded { Some(combined_seed.as_slice()) } else { None };
                current_word_bytes = func(&current_word_bytes, seed, &prng_factory)?;
            }

            deobfuscated_words.push(String::from_utf8(current_word_bytes)?);
            word_index += 1;
        }

        Ok(deobfuscated_words.join(" "))
    }

    fn encrypt_aes256(&self, data: &str, password: &str, iterations: u32) -> Result<String, Box<dyn std::error::Error>> {
        let mut salt = [0u8; SALT_SIZE_BYTES];
        rand::thread_rng().fill(&mut salt);
        
        let mut key = [0u8; KEY_SIZE];
        pbkdf2::<Hmac<Sha256>>(password.as_bytes(), &salt, iterations, &mut key)?;

        let mut iv = [0u8; IV_SIZE_BYTES];
        rand::thread_rng().fill(&mut iv);

        type Aes256CbcEnc = cbc::Encryptor<Aes256>;
        let mut buf = data.as_bytes().to_vec();
        
        let residue = buf.len() % 16;
        let padding = 16 - residue;
        for _ in 0..padding {
            buf.push(padding as u8);
        }

        let mut cipher = Aes256CbcEnc::new(&key.into(), &iv.into());
        cipher.encrypt_blocks_mut(unsafe {
            std::slice::from_raw_parts_mut(buf.as_mut_ptr() as *mut cbc::cipher::generic_array::GenericArray<u8, cbc::cipher::consts::U16>, buf.len() / 16)
        });

        key.zeroize();

        let salt_hex = hex::encode(salt);
        let iv_hex = hex::encode(iv);
        let content_base64 = general_purpose::STANDARD.encode(buf);

        Ok(format!("{}{}{}", salt_hex, iv_hex, content_base64))
    }

    fn encrypt_aes256_gcm(&self, data: &str, password: &str, iterations: u32) -> Result<String, Box<dyn std::error::Error>> {
        let mut salt = [0u8; SALT_SIZE_BYTES];
        rand::thread_rng().fill(&mut salt);
        
        let mut key = [0u8; KEY_SIZE];
        pbkdf2::<Hmac<Sha256>>(password.as_bytes(), &salt, iterations, &mut key)?;

        let mut iv_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut iv_bytes);

        let cipher = Aes256Gcm::new(key.as_slice().into());
        let nonce = Nonce::from_slice(&iv_bytes); 

        let ciphertext = cipher.encrypt(nonce, data.as_bytes())
            .map_err(|e| format!("AES GCM Encryption error: {:?}", e))?;

        key.zeroize();

        let salt_hex = hex::encode(salt);
        let iv_hex = hex::encode(iv_bytes);
        let content_base64 = general_purpose::STANDARD.encode(ciphertext);

        Ok(format!("{}{}{}", salt_hex, iv_hex, content_base64))
    }

    fn decrypt_aes256(&self, transit_message: &str, password: &str, iterations: u32) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        if transit_message.len() < 64 { return Err("Invalid message length".into()); }
        let salt_hex = &transit_message[..32];
        let iv_hex = &transit_message[32..64];
        let encrypted_base64 = &transit_message[64..];

        let salt = hex::decode(salt_hex)?;
        let iv = hex::decode(iv_hex)?;
        let mut ciphertext = general_purpose::STANDARD.decode(encrypted_base64)?;

        let mut key = [0u8; KEY_SIZE];
        pbkdf2::<Hmac<Sha256>>(password.as_bytes(), &salt, iterations, &mut key)?;

        type Aes256CbcDec = cbc::Decryptor<Aes256>;
        let iv_arr = cbc::cipher::generic_array::GenericArray::from_slice(&iv);
        let mut cipher = Aes256CbcDec::new(&key.into(), iv_arr);

        if ciphertext.len() % 16 != 0 { return Err("Ciphertext not multiple of block size".into()); }

        cipher.decrypt_blocks_mut(unsafe {
            std::slice::from_raw_parts_mut(ciphertext.as_mut_ptr() as *mut cbc::cipher::generic_array::GenericArray<u8, cbc::cipher::consts::U16>, ciphertext.len() / 16)
        });

        key.zeroize();

        // Unpad
        let padding_len = ciphertext.last().copied().unwrap_or(0) as usize;
        if padding_len == 0 || padding_len > 16 { return Err("Invalid padding".into()); }
        
        Ok(ciphertext[..ciphertext.len() - padding_len].to_vec())
    }

    fn decrypt_aes256_gcm(&self, transit_message: &str, password: &str, iterations: u32) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        if transit_message.len() < 64 { return Err("Invalid message length".into()); }
        let salt_hex = &transit_message[..32];
        let iv_hex = &transit_message[32..56]; // 12 bytes = 24 chars
        let encrypted_base64 = &transit_message[56..];

        let salt = hex::decode(salt_hex)?;
        let iv_bytes = hex::decode(iv_hex)?;
        let ciphertext = general_purpose::STANDARD.decode(encrypted_base64)?;

        let mut key = [0u8; KEY_SIZE];
        pbkdf2::<Hmac<Sha256>>(password.as_bytes(), &salt, iterations, &mut key)?;

        let cipher = Aes256Gcm::new(key.as_slice().into());
        let nonce = Nonce::from_slice(&iv_bytes);

        let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| format!("AES GCM Decryption error: {:?}", e))?;

        key.zeroize();
        Ok(plaintext)
    }
}

fn print_usage() {
    println!("Usage:");
    println!("  encrypt <mnemonic> <password>                   - Encrypt a mnemonic phrase");
    println!("  decrypt <encrypted_json> <reverse_key> <password> - Decrypt a phrase");
    println!("  test                                            - Run self-test");
}

fn main() {
    let mut args: Vec<String> = std::env::args().skip(1).collect();

    if args.is_empty() {
        print_usage();
        return;
    }

    let mut force_v2 = false;
    let mut force_v1 = false;
    if args[0] == "--v2" {
        force_v2 = true;
        args.remove(0);
    } else if args[0] == "--v1" {
        force_v1 = true;
        args.remove(0);
    } else if args[0] == "--v3" {
        args.remove(0);
    }

    if args.is_empty() {
        print_usage();
        return;
    }

    let command = &args[0];
    let dc = DarkstarCrypt::new();

    match command.as_str() {
        "encrypt" => {
            if args.len() < 3 {
                eprintln!("Usage: encrypt <mnemonic> <password>");
                std::process::exit(1);
            }
            let mnemonic = &args[1];
            let password = &args[2];
            match dc.encrypt(mnemonic, password, force_v2, force_v1) {
                Ok(json) => println!("{}", json),
                Err(e) => {
                    eprintln!("Encryption failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "decrypt" => {
            if args.len() < 4 {
                println!("Error: 'decrypt' requires <encrypted_json_or_data> <reverse_key> <password>");
                return;
            }
            let data = &args[1];
            let reverse_key = &args[2];
            let password = &args[3];
            match dc.decrypt(data, reverse_key, password) {
                Ok(decrypted) => println!("{}", decrypted),
                Err(e) => {
                    eprintln!("Decryption Error: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "test" => {
            let mnemonic = "cat dog fish bird";
            let password = "MySecre!Password123";

            println!("--- Darkstar Rust Self-Test ---");
            println!("Plaintext: {}", mnemonic);
            
            let result_json = match dc.encrypt(mnemonic, password, false, false) {
                Ok(json) => json,
                Err(e) => {
                    eprintln!("Test Encryption Failed: {}", e);
                    std::process::exit(1);
                }
            };
            let result: serde_json::Value = serde_json::from_str(&result_json).unwrap();
            
            let encrypted_data = result["encryptedData"].as_str().unwrap();
            let reverse_key = result["reverseKey"].as_str().unwrap();

            println!("Encrypted: {}", encrypted_data);
            
            let decrypted = match dc.decrypt(encrypted_data, reverse_key, password) {
                Ok(d) => d,
                Err(e) => {
                    eprintln!("Test Decryption Failed: {}", e);
                    std::process::exit(1);
                }
            };
            println!("Decrypted: {}", decrypted);

            if decrypted == mnemonic {
                println!("Result: PASSED");
            } else {
                println!("Result: FAILED");
                std::process::exit(1);
            }
        }
        _ => {
            println!("Error: Unknown command '{}'", command);
            print_usage();
        }
    }
}
