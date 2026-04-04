use aes::Aes256;
use base64::{engine::general_purpose, Engine as _};
use ml_kem::{MlKem1024, MlKem1024Params, KemCore, EncodedSizeUser};
use ml_kem::kem::{EncapsulationKey, DecapsulationKey, Encapsulate, Decapsulate};
use cbc::cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use hmac::Hmac;
use pbkdf2::pbkdf2;
use rand::Rng;
use zeroize::Zeroize;
use std::convert::TryFrom;

/// d-kasp-512 Encryption Suite
/// 
/// Implements the definitive Darkstar protocol (V5):
/// - D: Darkstar ecosystem origin
/// - K: ML-KEM-1024 (Kyber-1024) NIST Level 5 Root of Trust
/// - A: Augmented 64-layer SPN/ARX transformation gauntlet
/// - S: Sequential word-based path-logic
/// - P: Permutation-based non-linear core
/// - 1024: 256-bit Post-Quantum security parity


use serde_json;
use sha2::Sha256;

const SBOX_V4: [u8; 256] = [
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
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];

fn gf_mult_v4(mut a: u8, mut b: u8) -> u8 {
    let mut p = 0;
    for _ in 0..8 {
        if (b & 1) != 0 { p ^= a; }
        let hi_bit_set = (a & 0x80) != 0;
        a <<= 1;
        if hi_bit_set { a ^= 0x1B; }
        b >>= 1;
    }
    p
}

fn get_inv_sbox_v4() -> [u8; 256] {
    let mut inv = [0u8; 256];
    for i in 0..256 { inv[SBOX_V4[i] as usize] = i as u8; }
    inv
}

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

    fn next(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let mut t = self.state ^ (self.state >> 15);
        t = t.wrapping_mul(1 | self.state);
        let term2 = (t ^ (t >> 7)).wrapping_mul(61 | t);
        t = (t.wrapping_add(term2)) ^ t;

        t ^ (t >> 14)
    }
}

struct DarkstarChaChaPRNG {
    state: [u32; 8],
    counter: u32,
}

impl DarkstarChaChaPRNG {
    fn new(seed_str: &str) -> Self {
        use sha2::Digest;
        let hash = sha2::Sha256::digest(seed_str.as_bytes());
        let hash_hex = hex::encode(hash);
        let mut state = [0u32; 8];
        for i in 0..8 {
            let chunk = &hash_hex[i * 8..(i + 1) * 8];
            state[i] = u32::from_str_radix(chunk, 16).unwrap_or(0);
        }
        DarkstarChaChaPRNG { state, counter: 0 }
    }

    fn next(&mut self) -> u32 {
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

        t ^ (t >> 14)
    }
}

enum ActivePRNG {
    Mulberry(Mulberry32),
    DarkstarChaCha(DarkstarChaChaPRNG),
}

impl ActivePRNG {
    fn new(seed_str: &str, is_modern: bool) -> Self {
        if is_modern {
            ActivePRNG::DarkstarChaCha(DarkstarChaChaPRNG::new(seed_str))
        } else {
            ActivePRNG::Mulberry(Mulberry32::new(seed_str))
        }
    }

    fn next(&mut self) -> u32 {
        match self {
            ActivePRNG::Mulberry(m) => m.next(),
            ActivePRNG::DarkstarChaCha(p) => p.next(),
        }
    }
}

// --- DarkstarCrypt ---

type ObfuscationResult = Result<Vec<u8>, Box<dyn std::error::Error>>;
type ObfuscationFn = fn(&[u8], Option<&[u8]>, &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult;

struct DarkstarCrypt {
    obfuscation_functions_v2: Vec<ObfuscationFn>,
    deobfuscation_functions_v2: Vec<ObfuscationFn>,
    obfuscation_functions_v4: Vec<ObfuscationFn>,
    deobfuscation_functions_v4: Vec<ObfuscationFn>,
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
            obfuscation_functions_v4: vec![
                Self::obfuscate_sbox_v4,
                Self::obfuscate_modmult_v4,
                Self::obfuscate_pbox_v4,
                Self::obfuscate_cyclicrot_v4,
                Self::obfuscate_keyedxor_v4,
                Self::obfuscate_feistel_v4,
                Self::obfuscate_modadd_v4,
                Self::obfuscate_matrixhill_v4,
                Self::obfuscate_gfmult_v4,
                Self::obfuscate_bitflip_v4,
                Self::obfuscate_columnar_v4,
                Self::obfuscate_recxor_v4,
            ],
            deobfuscation_functions_v4: vec![
                Self::deobfuscate_sbox_v4,
                Self::deobfuscate_modmult_v4,
                Self::deobfuscate_pbox_v4,
                Self::deobfuscate_cyclicrot_v4,
                Self::deobfuscate_keyedxor_v4,
                Self::deobfuscate_feistel_v4,
                Self::deobfuscate_modadd_v4,
                Self::deobfuscate_matrixhill_v4,
                Self::deobfuscate_gfmult_v4,
                Self::deobfuscate_bitflip_v4,
                Self::deobfuscate_columnar_v4,
                Self::deobfuscate_recxor_v4,
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
            let j = ((rng.next() as u64 * (i + 1) as u64) >> 32) as usize;
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
            let j = ((rng.next() as u64 * (i + 1) as u64) >> 32) as usize;
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
            let rand_idx = ((rng.next() as u64 * random_chars.len() as u64) >> 32) as usize;
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
        let block_size = ((rng.next() as u64 * (input.len() / 2) as u64) >> 32) as usize + 2;
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
            let j = ((rng.next() as u64 * (i + 1) as u64) >> 32) as usize;
            chars.swap(i, j);
        }
        Ok(input.iter().map(|&b| chars[b as usize]).collect())
    }

    fn deobfuscate_with_seeded_substitution_v2(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut chars: Vec<u8> = (0..=255).collect();
        let seed_str = String::from_utf8(seed.unwrap_or(&[]).to_vec())?;
        let mut rng = prng_factory(&seed_str);
        for i in (1..=255).rev() {
            let j = ((rng.next() as u64 * (i + 1) as u64) >> 32) as usize;
            chars.swap(i, j);
        }
        let mut unsub_map = vec![0u8; 256];
        for (i, &c) in chars.iter().enumerate() {
            unsub_map[c as usize] = i as u8;
        }
        Ok(input.iter().map(|&b| unsub_map[b as usize]).collect())
    }

    // --- V4 Primitives ---
    fn obfuscate_sbox_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| SBOX_V4[b as usize]).collect())
    }
    fn deobfuscate_sbox_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let inv = get_inv_sbox_v4();
        Ok(input.iter().map(|&b| inv[b as usize]).collect())
    }
    fn obfuscate_modmult_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| ((b as u16 * 167) & 0xFF) as u8).collect())
    }
    fn deobfuscate_modmult_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| ((b as u16 * 23) & 0xFF) as u8).collect())
    }
    fn obfuscate_pbox_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut out = vec![0u8; input.len()];
        let len = input.len();
        for i in 0..len {
            let mut b = input[i];
            b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4);
            b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2);
            b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1);
            out[len - 1 - i] = b;
        }
        Ok(out)
    }
    fn deobfuscate_pbox_v4(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_pbox_v4(input, seed, prng_factory)
    }
    fn obfuscate_cyclicrot_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| (b >> 3) | (b << 5)).collect())
    }
    fn deobfuscate_cyclicrot_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| (b << 3) | (b >> 5)).collect())
    }
    fn obfuscate_keyedxor_v4(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| b ^ seed[i % seed.len()]).collect())
    }
    fn deobfuscate_keyedxor_v4(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_keyedxor_v4(input, seed, prng_factory)
    }
    fn obfuscate_feistel_v4(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut out = input.to_vec();
        let half = out.len() / 2;
        if half == 0 { return Ok(out); }
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(out); }
        for i in 0..half {
            let f = out[half + i].wrapping_add(seed[i % seed.len()]);
            out[i] ^= f;
        }
        Ok(out)
    }
    fn deobfuscate_feistel_v4(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_feistel_v4(input, seed, prng_factory)
    }
    fn obfuscate_modadd_v4(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| b.wrapping_add(seed[i % seed.len()])).collect())
    }
    fn deobfuscate_modadd_v4(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| b.wrapping_sub(seed[i % seed.len()])).collect())
    }
    fn obfuscate_matrixhill_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut out = input.to_vec();
        if out.is_empty() { return Ok(out); }
        for i in 1..out.len() { out[i] = out[i].wrapping_add(out[i - 1]); }
        Ok(out)
    }
    fn deobfuscate_matrixhill_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut out = input.to_vec();
        if out.is_empty() { return Ok(out); }
        for i in (1..out.len()).rev() { out[i] = out[i].wrapping_sub(out[i - 1]); }
        Ok(out)
    }
    fn obfuscate_gfmult_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| gf_mult_v4(b, 0x02)).collect())
    }
    fn deobfuscate_gfmult_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Ok(input.iter().map(|&b| gf_mult_v4(b, 0x8D)).collect())
    }
    fn obfuscate_bitflip_v4(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| {
            let mask = seed[i % seed.len()];
            b ^ ((mask & 0xAA) | (!mask & 0x55))
        }).collect())
    }
    fn deobfuscate_bitflip_v4(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        Self::obfuscate_bitflip_v4(input, seed, prng_factory)
    }
    fn obfuscate_columnar_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let n = input.len();
        let mut out = vec![0u8; n];
        let cols = 3;
        let mut idx = 0;
        for c in 0..cols {
            let mut i = c;
            while i < n {
                out[idx] = input[i];
                idx += 1;
                i += cols;
            }
        }
        Ok(out)
    }
    fn deobfuscate_columnar_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let n = input.len();
        let mut out = vec![0u8; n];
        let cols = 3;
        let mut idx = 0;
        for c in 0..cols {
            let mut i = c;
            while i < n {
                out[i] = input[idx];
                idx += 1;
                i += cols;
            }
        }
        Ok(out)
    }
    fn obfuscate_recxor_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut out = input.to_vec();
        if out.is_empty() { return Ok(out); }
        for i in 1..out.len() { out[i] = out[i - 1] ^ out[i]; }
        Ok(out)
    }
    fn deobfuscate_recxor_v4(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        let mut out = input.to_vec();
        if out.is_empty() { return Ok(out); }
        for i in (1..out.len()).rev() { out[i] = out[i] ^ out[i - 1]; }
        Ok(out)
    }

    // --- Compression Helpers ---

    fn pack_reverse_key(reverse_key: &Vec<Vec<usize>>, is_modern: bool) -> Result<String, Box<dyn std::error::Error>> {
        let mut buffer = Vec::new();
        for word_key in reverse_key {
            if is_modern {
                // Uint16BE length header
                let l = word_key.len() as u16;
                buffer.extend_from_slice(&l.to_be_bytes());
            }
            for chunk in word_key.chunks(2) {
                let high = (chunk[0] & 0x0F) as u8;
                let low = if chunk.len() > 1 { (chunk[1] & 0x0F) as u8 } else { 0 };
                buffer.push((high << 4) | low);
            }
        }
        Ok(general_purpose::STANDARD.encode(&buffer))
    }

    fn unpack_reverse_key(b64: &str, is_modern: bool) -> Result<Vec<Vec<usize>>, Box<dyn std::error::Error>> {
        let bytes = general_purpose::STANDARD.decode(b64)?;
        let mut reverse_key = Vec::new();
        
        let mut offset = 0;
        while offset < bytes.len() {
            let word_len = if is_modern {
                if offset + 2 > bytes.len() { break; }
                let l = u16::from_be_bytes([bytes[offset], bytes[offset+1]]) as usize;
                offset += 2;
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

    fn encrypt(&self, mnemonic: &str, key_material: &str, force_v2: bool, force_v1: bool, force_v3: bool, force_v4: bool, force_v5: bool) -> Result<String, Box<dyn std::error::Error>> {
        let words: Vec<&str> = mnemonic.split(' ').collect();
        let mut obfuscated_words = Vec::new();
        let mut reverse_key = Vec::new();

        let is_v5 = force_v5;
        let is_v4 = (!force_v3 && !force_v2 && !force_v1 && !force_v5) || force_v4;
        let is_v3 = force_v3;
        let is_modern = is_v3 || is_v4 || is_v5;
        
        let mut ct_hex = String::new();
        let mut ss_hex = String::new();
        let mut active_password_str = key_material.to_string();

        if is_v5 {
            let pk_bytes: [u8; 1568] = hex::decode(key_material)?
                .try_into()
                .map_err(|_| "Invalid public key length for ML-KEM-1024")?;
            
            let ek = EncapsulationKey::<MlKem1024Params>::from_bytes(&pk_bytes.into());
            let (ct, ss) = ek.encapsulate(&mut rand::thread_rng())
                .map_err(|e| format!("ML-KEM Encapsulation failed: {:?}", e))?;
            
            ct_hex = hex::encode(ct.as_slice());
            ss_hex = hex::encode(ss.as_slice());
            active_password_str = ss_hex.clone();
        }

        let password_bytes = active_password_str.as_bytes();
        let prng_factory = |s: &str| ActivePRNG::new(s, is_modern);

        for word in words {
            let mut current_word_bytes = word.as_bytes().to_vec();

            let mut selected_functions: Vec<usize> = (0..12).collect();
            let seed_for_selection = format!("{}{}", active_password_str, word);
            let mut rng_sel = prng_factory(&seed_for_selection);
            
            for i in (1..12).rev() {
                let j = ((rng_sel.next() as u64 * (i + 1) as u64) >> 32) as usize;
                selected_functions.swap(i, j);
            }

            let mut cycle_depth = selected_functions.len();
            if is_modern {
                use sha2::Digest;
                let hash = sha2::Sha256::digest(seed_for_selection.as_bytes());
                let hash_hex = hex::encode(hash);
                if let Ok(depth_val) = usize::from_str_radix(&hash_hex[..4], 16) {
                    cycle_depth = if is_v5 { 12 + (depth_val % 501) } else { 12 + (depth_val % 53) };
                }
            }

            let checksum = Self::generate_checksum(&selected_functions);
            let checksum_bytes = checksum.to_string().into_bytes();
            let combined_seed = [password_bytes, &checksum_bytes].concat();

            let mut word_reverse_key = Vec::new();

            for i in 0..cycle_depth {
                let mut func_index = selected_functions[i % selected_functions.len()];

                if i >= 12 && !is_v4 && !is_v5 && (func_index == 2 || func_index == 3 || func_index == 8 || func_index == 9) {
                    func_index = (func_index + 2) % 12;
                }

                let is_seeded = if is_v4 || is_v5 {
                    func_index == 4 || func_index == 5 || func_index == 6 || func_index == 9
                } else {
                    func_index >= 6
                };
                let seed = if is_seeded { Some(combined_seed.as_slice()) } else { None };

                let func = if is_v4 || is_v5 {
                    self.obfuscation_functions_v4[func_index]
                } else {
                    self.obfuscation_functions_v2[func_index]
                };
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
        
        let target_iterations = ITERATIONS_V2;
        let encrypted_content = if is_modern {
            self.encrypt_aes256_gcm(&base64_content, &active_password_str, target_iterations)?
        } else {
            self.encrypt_aes256(&base64_content, &active_password_str, target_iterations)?
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
        let encoded_reverse_key = Self::pack_reverse_key(&reverse_key, is_modern)?;

        let v_protocol = if is_v5 { 5 } else if is_v4 { 4 } else if is_v3 { 3 } else { 2 };

        let mut result_obj = serde_json::json!({
            "v": v_protocol,
            "data": encrypted_content
        });
        
        if is_v5 {
            result_obj["ct"] = serde_json::json!(ct_hex);
        }

        let result_json_str = result_obj.to_string();
        let final_json = serde_json::json!({
            "encryptedData": result_json_str,
            "reverseKey": encoded_reverse_key
        }).to_string();

        Ok(final_json)
    }

    /// Decrypts the encrypted data back to the original mnemonic.
    fn decrypt(&self, encrypted_data_raw: &str, reverse_key_b64: &str, key_material: &str) -> Result<String, Box<dyn std::error::Error>> {
        // 1. Decode Reverse Key (Auto-detect Legacy JSON vs Packed Binary)
        let mut is_header_modern = false;
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(encrypted_data_raw) {
            if value["v"] == 3 || value["v"] == 4 || value["v"] == 5 {
                is_header_modern = true;
            }
        }

        let reverse_key: Vec<Vec<usize>> = if let Ok(bytes) = general_purpose::STANDARD.decode(reverse_key_b64) {
            if let Ok(rk) = serde_json::from_slice::<Vec<Vec<usize>>>(&bytes) {
                rk
            } else {
                Self::unpack_reverse_key(reverse_key_b64, is_header_modern)?
            }
        } else {
             return Err("Invalid base64 in reverse key".into());
        };

        let mut encrypted_content = String::new();
        let mut is_v3 = false;
        let mut is_v4 = false;
        let mut is_v5 = false;
        let mut ct_hex = String::new();
        
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(encrypted_data_raw) {
            if value["v"] == 2 {
                if let Some(data) = value["data"].as_str() {
                    encrypted_content = data.to_string();
                }
            } else if value["v"] == 3 {
                if let Some(data) = value["data"].as_str() {
                    encrypted_content = data.to_string();
                    is_v3 = true;
                }
            } else if value["v"] == 4 {
                if let Some(data) = value["data"].as_str() {
                    encrypted_content = data.to_string();
                    is_v4 = true;
                }
            } else if value["v"] == 5 {
                if let Some(data) = value["data"].as_str() {
                    encrypted_content = data.to_string();
                    is_v5 = true;
                }
                if let Some(ct) = value["ct"].as_str() {
                    ct_hex = ct.to_string();
                }
            }
        }
        if encrypted_content.is_empty() {
            encrypted_content = encrypted_data_raw.to_string();
        }

        let is_modern = is_v3 || is_v4 || is_v5;
        let mut active_password_str = key_material.to_string();
        if is_v5 {
            let sk_bytes: [u8; 3168] = hex::decode(key_material)?
                .try_into()
                .map_err(|_| "Invalid secret key length for ML-KEM-1024")?;
            let ct_vec = hex::decode(&ct_hex)?;
            let ct_bytes: [u8; 1568] = ct_vec
                .try_into()
                .map_err(|_| "Invalid ciphertext length for ML-KEM-1024")?;
            
            let dk = DecapsulationKey::<MlKem1024Params>::from_bytes(&sk_bytes.into());
            let ss = dk.decapsulate(&ct_bytes.into())
                .map_err(|e| format!("ML-KEM Decapsulation failed: {:?}", e))?;
            
            active_password_str = hex::encode(ss.as_slice());
        }

        let target_iterations = ITERATIONS_V2;
        let decrypted_base64_bytes = if is_modern {
            self.decrypt_aes256_gcm(&encrypted_content, &active_password_str, target_iterations)?
        } else {
            self.decrypt_aes256(&encrypted_content, &active_password_str, target_iterations)?
        };
        let binary_string = String::from_utf8(decrypted_base64_bytes)?;
        let full_blob = general_purpose::STANDARD.decode(binary_string)?;

        let mut deobfuscated_words = Vec::new();
        let password_bytes = active_password_str.as_bytes();
        let prng_factory = |s: &str| ActivePRNG::new(s, is_modern);

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
                let is_seeded = if is_v4 || is_v5 {
                    func_index == 4 || func_index == 5 || func_index == 6 || func_index == 9
                } else {
                    func_index >= 6
                };
                let seed = if is_seeded { Some(combined_seed.as_slice()) } else { None };

                let func = if is_v4 || is_v5 {
                    self.deobfuscation_functions_v4[func_index]
                } else {
                    self.deobfuscation_functions_v2[func_index]
                };
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
    println!("d-kasp-512 Encryption Suite (V5)");
    println!("Usage: darkstar_rust [--v5|--v4|--v3|--v2|--v1] <encrypt|decrypt|keygen|test> ...");
    println!("  --v5: d-kasp-512 (Kyber-1024 + Augmented SPN/ARX)");
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
    let mut force_v3 = false;
    let mut force_v4 = false;
    let mut force_v5 = false;
    if args[0] == "--v2" {
        force_v2 = true;
        args.remove(0);
    } else if args[0] == "--v1" {
        force_v1 = true;
        args.remove(0);
    } else if args[0] == "--v3" {
        force_v3 = true;
        args.remove(0);
    } else if args[0] == "--v4" {
        force_v4 = true;
        args.remove(0);
    } else if args[0] == "--v5" {
        force_v5 = true;
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
            match dc.encrypt(mnemonic, password, force_v2, force_v1, force_v3, force_v4, force_v5) {
                Ok(res) => println!("{}", res),
                Err(e) => {
                    eprintln!("Encryption failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "decrypt" => {
            if args.len() < 4 {
                eprintln!("Usage: decrypt <encrypted_data> <reverse_key> <password>");
                std::process::exit(1);
            }
            let enc_data = &args[1];
            let rev_key = &args[2];
            let password = &args[3];
            match dc.decrypt(enc_data, rev_key, password) {
                Ok(res) => {
                    print!("{}", res);
                    std::process::exit(0);
                }
                Err(e) => {
                    eprintln!("Decryption failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "keygen" => {
            use ml_kem::KemCore;
            let mut rng = rand::thread_rng();
            let (ek, dk) = MlKem1024::generate(&mut rng);
            
            println!("PublicKey: {}", hex::encode(ek.as_bytes()));
            println!("PrivateKey: {}", hex::encode(dk.as_bytes()));
            std::process::exit(0);
        }
        "test" => {
            let mnemonic = "cat dog fish bird";
            let mut password = "MySecre!Password123".to_string();

            let mut test_sk = String::new();
            if force_v5 {
                let mut rng = rand::thread_rng();
                let (ek, dk) = MlKem1024::generate(&mut rng);
                password = hex::encode(ek.as_bytes());
                test_sk = hex::encode(dk.as_bytes());
            }

            println!("--- d-kasp-512 Rust Self-Test ---");
            println!("Plaintext: {}", mnemonic);
            
            match dc.encrypt(mnemonic, &password, force_v2, force_v1, force_v3, force_v4, force_v5) {
                Ok(result_json) => {
                    let result: serde_json::Value = serde_json::from_str(&result_json).unwrap();
                    
                    let encrypted_data = result["encryptedData"].as_str().unwrap();
                    let reverse_key = result["reverseKey"].as_str().unwrap();

                    println!("Encrypted: {}", encrypted_data);
                    
                    let dec_psw = if force_v5 { &test_sk } else { &password };
                    let decrypted = match dc.decrypt(encrypted_data, reverse_key, dec_psw) {
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
                },
                Err(e) => {
                    eprintln!("Test Encryption Failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        _ => {
            println!("Error: Unknown command '{}'", command);
            print_usage();
        }
    }
}

