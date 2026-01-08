use aes::Aes256;
use base64::{engine::general_purpose, Engine as _};
use cbc::cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit};
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

use zeroize::Zeroize;

// --- DarkstarCrypt ---

type ObfuscationResult = Result<Vec<u8>, Box<dyn std::error::Error>>;
type ObfuscationFn = fn(&[u8], Option<&[u8]>, &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult;

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

    fn obfuscate_by_reversing_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        Ok(input.iter().rev().cloned().collect())
    }
    fn deobfuscate_by_reversing_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        Self::obfuscate_by_reversing_v2(input, seed, prng_factory)
    }

    fn obfuscate_with_atbash_cipher_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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
    fn deobfuscate_with_atbash_cipher_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        Self::obfuscate_with_atbash_cipher_v2(input, seed, prng_factory)
    }

    fn obfuscate_to_char_codes_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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

    fn deobfuscate_from_char_codes_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        let s = String::from_utf8(input.to_vec())?;
        if s.is_empty() { return Ok(Vec::new()); }
        let res = s.split(',')
            .filter(|p| !p.is_empty())
            .map(|p| p.parse::<u8>().map_err(|e| e.into()))
            .collect::<Result<Vec<u8>, Box<dyn std::error::Error>>>()?;
        Ok(res)
    }

    fn obfuscate_to_binary_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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

    fn deobfuscate_from_binary_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        let s = String::from_utf8(input.to_vec())?;
        if s.is_empty() { return Ok(Vec::new()); }
        let res = s.split(',')
            .filter(|p| !p.is_empty())
            .map(|p| u8::from_str_radix(p, 2).map_err(|e| e.into()))
            .collect::<Result<Vec<u8>, Box<dyn std::error::Error>>>()?;
        Ok(res)
    }

    fn obfuscate_with_caesar_cipher_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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
    fn deobfuscate_with_caesar_cipher_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        Self::obfuscate_with_caesar_cipher_v2(input, seed, prng_factory)
    }

    fn obfuscate_by_swapping_adjacent_bytes_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        let mut output = input.to_vec();
        for i in (0..output.len().saturating_sub(1)).step_by(2) {
            output.swap(i, i + 1);
        }
        Ok(output)
    }
    fn deobfuscate_by_swapping_adjacent_bytes_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        Self::obfuscate_by_swapping_adjacent_bytes_v2(input, seed, prng_factory)
    }

    fn obfuscate_by_shuffling_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        let mut output = input.to_vec();
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        for i in (1..output.len()).rev() {
            let j = (rng.next() * (i + 1) as f64) as usize;
            output.swap(i, j);
        }
        Ok(output)
    }

    fn deobfuscate_by_shuffling_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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

    fn obfuscate_with_xor_v2(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| b ^ seed[i % seed.len()]).collect())
    }
    fn deobfuscate_with_xor_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        Self::obfuscate_with_xor_v2(input, seed, prng_factory)
    }

    fn obfuscate_by_interleaving_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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

    fn deobfuscate_by_deinterleaving_v2(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        Ok(input.iter().step_by(2).cloned().collect())
    }

    fn obfuscate_with_vigenere_cipher_v2(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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

    fn deobfuscate_with_vigenere_cipher_v2(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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

    fn obfuscate_with_seeded_block_reversal_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        let block_size = (rng.next() * (input.len() / 2) as f64) as usize + 2;
        let mut output = input.to_vec();
        for chunk in output.chunks_mut(block_size) {
            chunk.reverse();
        }
        Ok(output)
    }
    fn deobfuscate_with_seeded_block_reversal_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        Self::obfuscate_with_seeded_block_reversal_v2(input, seed, prng_factory)
    }

    fn obfuscate_with_seeded_substitution_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
        let mut chars: Vec<u8> = (0..=255).collect();
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        for i in (1..=255).rev() {
            let j = (rng.next() * (i + 1) as f64) as usize;
            chars.swap(i, j);
        }
        Ok(input.iter().map(|&b| chars[b as usize]).collect())
    }

    fn deobfuscate_with_seeded_substitution_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> Mulberry32) -> ObfuscationResult {
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

    fn pack_reverse_key(reverse_key: &Vec<Vec<usize>>) -> Result<String, Box<dyn std::error::Error>> {
        let mut buffer = Vec::new();
        for word_key in reverse_key {
            if word_key.len() != 12 {
                return Err("Invalid word key length for packing".into());
            }
            for chunk in word_key.chunks(2) {
                let high = (chunk[0] & 0x0F) as u8;
                let low = (chunk[1] & 0x0F) as u8;
                buffer.push((high << 4) | low);
            }
        }
        Ok(general_purpose::STANDARD.encode(&buffer))
    }

    fn unpack_reverse_key(b64: &str) -> Result<Vec<Vec<usize>>, Box<dyn std::error::Error>> {
        let bytes = general_purpose::STANDARD.decode(b64)?;
        let mut reverse_key = Vec::new();
        // 6 bytes per word
        if bytes.len() % 6 != 0 {
             return Err("Invalid packed key length".into());
        }
        
        for chunk in bytes.chunks(6) {
            let mut word_key = Vec::new();
            for &b in chunk {
                let high = ((b >> 4) & 0x0F) as usize;
                let low = (b & 0x0F) as usize;
                word_key.push(high);
                word_key.push(low);
            }
            reverse_key.push(word_key);
        }
        Ok(reverse_key)
    }

    /// Encrypts a mnemonic phrase using the Darkstar encryption scheme.
    fn encrypt(&self, mnemonic: &str, password: &str) -> Result<String, Box<dyn std::error::Error>> {
        let words: Vec<&str> = mnemonic.split(' ').collect();
        let mut obfuscated_words = Vec::new();
        let mut reverse_key = Vec::new();

        let password_bytes = password.as_bytes();
        let prng_factory = |s: &str| Mulberry32::new(s);

        for word in words {
            let mut current_word_bytes = word.as_bytes().to_vec();

            let mut selected_functions: Vec<usize> = (0..12).collect();
            let seed_for_selection = format!("{}{}", password, word);
            let mut rng_sel = Mulberry32::new(&seed_for_selection);
            
            for i in (1..12).rev() {
                let j = (rng_sel.next() * (i + 1) as f64) as usize;
                selected_functions.swap(i, j);
            }

            let checksum = Self::generate_checksum(&selected_functions);
            let checksum_bytes = checksum.to_string().into_bytes();
            let combined_seed = [password_bytes, &checksum_bytes].concat();

            let mut word_reverse_key = Vec::new();

            for &func_index in &selected_functions {
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
        let encrypted_content = self.encrypt_aes256(&base64_content, password, ITERATIONS_V2)?;

        // Packed Binary Reverse Key
        let encoded_reverse_key = Self::pack_reverse_key(&reverse_key)?;

        let result_obj = serde_json::json!({
            "v": 2,
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
        let reverse_key: Vec<Vec<usize>> = if let Ok(bytes) = general_purpose::STANDARD.decode(reverse_key_b64) {
            if let Ok(rk) = serde_json::from_slice::<Vec<Vec<usize>>>(&bytes) {
                rk
            } else {
                Self::unpack_reverse_key(reverse_key_b64)?
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
            }
        }
        if encrypted_content.is_empty() {
            encrypted_content = encrypted_data_raw.to_string();
        }

        let decrypted_base64_bytes = self.decrypt_aes256(&encrypted_content, password, ITERATIONS_V2)?;
        let binary_string = String::from_utf8(decrypted_base64_bytes)?;
        let full_blob = general_purpose::STANDARD.decode(binary_string)?;

        let mut deobfuscated_words = Vec::new();
        let password_bytes = password.as_bytes();
        let prng_factory = |s: &str| Mulberry32::new(s);

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
            let checksum = Self::generate_checksum(word_reverse_list);
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
}

fn print_usage() {
    println!("Usage:");
    println!("  encrypt <mnemonic> <password>                   - Encrypt a mnemonic phrase");
    println!("  decrypt <encrypted_json> <reverse_key> <password> - Decrypt a phrase");
    println!("  test                                            - Run self-test");
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        print_usage();
        return;
    }

    let dc = DarkstarCrypt::new();
    let command = &args[1];

    match command.as_str() {
        "encrypt" => {
            if args.len() != 4 {
                println!("Error: 'encrypt' requires <mnemonic> and <password>");
                println!("Example: encrypt \"cat dog fish bird\" \"mypass123\"");
                return;
            }
            let mnemonic = &args[2];
            let password = &args[3];
            match dc.encrypt(mnemonic, password) {
                Ok(result) => println!("{}", result),
                Err(e) => {
                    eprintln!("Encryption Error: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "decrypt" => {
            if args.len() != 5 {
                println!("Error: 'decrypt' requires <encrypted_json_or_data> <reverse_key> <password>");
                return;
            }
            let data = &args[2];
            let reverse_key = &args[3];
            let password = &args[4];
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
            
            let result_json = match dc.encrypt(mnemonic, password) {
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
