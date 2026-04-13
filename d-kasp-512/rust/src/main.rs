use aes::Aes256;
use base64::{engine::general_purpose, Engine as _};
use ml_kem::{MlKem1024, MlKem1024Params, KemCore, EncodedSizeUser};
use ml_kem::kem::{EncapsulationKey, DecapsulationKey, Encapsulate, Decapsulate};
use cbc::cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit, block_padding::Pkcs7};
use aes_gcm::{aead::{Aead, KeyInit, Payload}, Aes256Gcm, Nonce};
use hmac::Hmac;
use pbkdf2::pbkdf2;
use rand::Rng;
use zeroize::Zeroize;
use sha2::Sha256;
use std::fs;

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
    state: [u32; 16],
    block: [u32; 16],
    block_idx: usize,
}

impl DarkstarChaChaPRNG {
    fn new(seed_str: &str) -> Self {
        use sha2::Digest;
        let hash = sha2::Sha256::digest(seed_str.as_bytes());
        let mut state = [0u32; 16];
        state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574;
        for i in 0..8 {
            let chunk = &hash[i*4..(i+1)*4];
            state[4+i] = u32::from_le_bytes(chunk.try_into().unwrap());
        }
        state[12] = 0; // counter
        state[13] = 0; // nonce
        state[14] = 0; // nonce
        state[15] = 0; // nonce

        let block = Self::chacha_block(&state);
        DarkstarChaChaPRNG { state, block, block_idx: 0 }
    }

    fn chacha_block(st: &[u32; 16]) -> [u32; 16] {
        let mut x = *st;
        fn rotate(v: u32, n: u32) -> u32 { (v << n) | (v >> (32 - n)) }
        fn quarter_round(x: &mut [u32; 16], a: usize, b: usize, c: usize, d: usize) {
            x[a] = x[a].wrapping_add(x[b]); x[d] ^= x[a]; x[d] = rotate(x[d], 16);
            x[c] = x[c].wrapping_add(x[d]); x[b] ^= x[c]; x[b] = rotate(x[b], 12);
            x[a] = x[a].wrapping_add(x[b]); x[d] ^= x[a]; x[d] = rotate(x[d], 8);
            x[c] = x[c].wrapping_add(x[d]); x[b] ^= x[c]; x[b] = rotate(x[b], 7);
        }
        for _ in 0..10 {
            quarter_round(&mut x, 0, 4, 8, 12); quarter_round(&mut x, 1, 5, 9, 13);
            quarter_round(&mut x, 2, 6, 10, 14); quarter_round(&mut x, 3, 7, 11, 15);
            quarter_round(&mut x, 0, 5, 10, 15); quarter_round(&mut x, 1, 6, 11, 12);
            quarter_round(&mut x, 2, 7, 8, 13); quarter_round(&mut x, 3, 4, 9, 14);
        }
        for i in 0..16 { x[i] = x[i].wrapping_add(st[i]); }
        x
    }

    fn next(&mut self) -> u32 {
        if self.block_idx >= 16 {
            self.state[12] = self.state[12].wrapping_add(1);
            self.block = Self::chacha_block(&self.state);
            self.block_idx = 0;
        }
        let val = self.block[self.block_idx];
        self.block_idx += 1;
        val
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
                Self::obfuscate_mds_network_v9,
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
                Self::deobfuscate_mds_network_v9,
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

    const MDS_MATRIX: [[u8; 4]; 4] = [
        [0x02, 0x03, 0x01, 0x01],
        [0x01, 0x02, 0x03, 0x01],
        [0x01, 0x01, 0x02, 0x03],
        [0x03, 0x01, 0x01, 0x02]
    ];

    const INV_MDS_MATRIX: [[u8; 4]; 4] = [
        [0x0E, 0x0B, 0x0D, 0x09],
        [0x09, 0x0E, 0x0B, 0x0D],
        [0x0D, 0x09, 0x0E, 0x0B],
        [0x0B, 0x0D, 0x09, 0x0E]
    ];

    fn obfuscate_mds_network_v9(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        if input.len() < 4 { return Self::obfuscate_matrixhill_v4(input, _seed, _prng_factory); }
        let mut out = vec![0u8; input.len()];
        for i in (0..input.len()).step_by(4) {
            let end = (i + 4).min(input.len());
            let block = &input[i..end];
            if block.len() < 4 {
                for j in 0..block.len() { out[i+j] = block[j]; }
                continue;
            }
            for row in 0..4 {
                let mut sum = 0u8;
                for col in 0..4 {
                    sum ^= gf_mult_v4(block[col], Self::MDS_MATRIX[row][col]);
                }
                out[i + row] = sum;
            }
        }
        Ok(out)
    }

    fn deobfuscate_mds_network_v9(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> ObfuscationResult {
        if input.len() < 4 { return Self::deobfuscate_matrixhill_v4(input, _seed, _prng_factory); }
        let mut out = vec![0u8; input.len()];
        for i in (0..input.len()).step_by(4) {
            let end = (i + 4).min(input.len());
            let block = &input[i..end];
            if block.len() < 4 {
                for j in 0..block.len() { out[i+j] = block[j]; }
                continue;
            }
            for row in 0..4 {
                let mut sum = 0u8;
                for col in 0..4 {
                    sum ^= gf_mult_v4(block[col], Self::INV_MDS_MATRIX[row][col]);
                }
                out[i + row] = sum;
            }
        }
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
        let filtered_rk = clean_b64(b64);
        let bytes = general_purpose::STANDARD.decode(&filtered_rk)?;
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

    fn encrypt(&self, mnemonic: &str, key_material: &str, v: u32) -> Result<String, Box<dyn std::error::Error>> {
        let is_v5 = v >= 5;
        let is_v4 = v == 4;
        let is_modern = v >= 3;
        
        let mut active_password_str = key_material.to_string();
        let mut ct_hex = String::new();
        let mut ct_bytes_v7 = Vec::new();
        let mut v7_hmac_key = None;

        if v >= 5 {
            let pk_hex = clean_hex(key_material);
            let pk_bytes: [u8; 1568] = hex::decode(&pk_hex)?
                .try_into()
                .map_err(|_| "Invalid public key length for ML-KEM-1024")?;
            
            let ek = EncapsulationKey::<MlKem1024Params>::from_bytes(&pk_bytes.into());
            let (ct, mut ss) = ek.encapsulate(&mut rand::thread_rng())
                .map_err(|e| format!("ML-KEM Encapsulation failed: {:?}", e))?;
            
            ct_hex = hex::encode(ct.as_slice());
            ct_bytes_v7 = ct.as_slice().to_vec();
            let ss_bytes = ss.as_slice();
            
            if v >= 7 {
                use sha2::Digest;
                let mut hasher = sha2::Sha256::new();
                hasher.update(b"dkasp-v7-cipher-key");
                hasher.update(ss_bytes);
                active_password_str = hex::encode(hasher.finalize());
                
                let mut hasher = sha2::Sha256::new();
                hasher.update(b"dkasp-v7-hmac-key");
                hasher.update(ss_bytes);
                v7_hmac_key = Some(hasher.finalize().to_vec());
            } else {
                active_password_str = hex::encode(ss_bytes);
            }
            ss.zeroize();
        }

        let words: Vec<&str> = if v >= 6 { vec![mnemonic] } else { mnemonic.split(' ').collect() };
        let prng_factory = |s: &str| ActivePRNG::new(s, is_modern);

        let mut obfuscated_words = Vec::new();
        let mut reverse_key = Vec::new();

        // Fix 2: Chain state init — cross-word diffusion (V6 only)
        let mut chain_state: Vec<u8> = if v >= 6 {
            use sha2::Digest;
            sha2::Sha256::digest(format!("dkasp-chain-v6{}", active_password_str).as_bytes()).to_vec()
        } else { Vec::new() };

        for (index, word) in words.iter().enumerate() {
            let mut current_word_bytes = word.as_bytes().to_vec();

            if v >= 6 {
                // Fix 1: HMAC-SHA256 key schedule — derive per-word subkey
                use hmac::Mac;
                type HmacSha256 = hmac::Hmac<sha2::Sha256>;
                let word_key: Vec<u8> = {
                    let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(active_password_str.as_bytes())
                        .map_err(|e| format!("HMAC init error: {:?}", e))?;
                    mac.update(format!("dkasp-v6-word-{}", index).as_bytes());
                    mac.finalize().into_bytes().to_vec()
                };
                let word_key_hex = hex::encode(&word_key);

                // Fix 2: XOR word bytes with chain state before gauntlet
                for (i, b) in current_word_bytes.iter_mut().enumerate() {
                    *b ^= chain_state[i % 32];
                }

                // Fix 4: Generate path with degeneration prevention (max 3 consecutive identical)
                let seed_for_selection = &word_key_hex;
                let mut rng_path = prng_factory(seed_for_selection);
                use sha2::Digest;
                let hash = sha2::Sha256::digest(seed_for_selection.as_bytes());
                let cycle_depth = 12 + (usize::from_str_radix(&hex::encode(hash)[..4], 16).unwrap_or(0) % 501);

                let mut path: Vec<usize> = Vec::with_capacity(cycle_depth);
                let mut last_three = [99usize; 3];
                for _ in 0..cycle_depth {
                    let mut fi = (rng_path.next() as usize) % 12;
                    // Prevent run of >3 identical consecutive
                    if last_three[0] == fi && last_three[1] == fi && last_three[2] == fi {
                        fi = (fi + 1 + (rng_path.next() as usize % 11)) % 12;
                    }
                    last_three[0] = last_three[1];
                    last_three[1] = last_three[2];
                    last_three[2] = fi;
                    path.push(fi);
                }

                // Ensure min 6 distinct functions in first 12 slots (fix 4b)
                {
                    let path_clone = path[..12.min(path.len())].to_vec();
                    let distinct: std::collections::HashSet<usize> = path_clone.iter().cloned().collect();
                    if distinct.len() < 6 {
                        let missing: Vec<usize> = (0..12).filter(|x| !distinct.contains(x)).collect();
                        let mut mi = 0;
                        for i in 0..12.min(path.len()) {
                            let count = path_clone.iter().filter(|&&x| x == path[i]).count();
                            if count > 2 && mi < missing.len() {
                                path[i] = missing[mi]; mi += 1;
                            }
                        }
                    }
                }

                // Fix 1: Derive combined seed for keyed functions via HMAC
                let checksum = Self::generate_checksum(&(0..12).collect::<Vec<_>>());
                let func_key: Vec<u8> = {
                    let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&word_key)
                        .map_err(|e| format!("HMAC init error: {:?}", e))?;
                    mac.update(format!("keyed-{}", checksum).as_bytes());
                    mac.finalize().into_bytes().to_vec()
                };

                if v >= 8 {
                    // V8: SPNA Structured Gauntlet (16 Rounds = 64 Layers)
                    let mut rng_path = prng_factory(&word_key_hex);
                    let group_s = [0usize, 1, 5];
                    let group_p = [2usize, 3, 10];
                    let group_n = if v >= 9 { [12usize, 12, 11] } else { [7usize, 8, 11] };
                    let group_a = [4usize, 6, 9];

                    for i in 0..16 {
                        // S: Substitution (Forced S-Box or ModMult every 4 rounds)
                        let s_idx = if i % 4 == 0 {
                            0
                        } else if i % 4 == 2 {
                            1
                        } else {
                            group_s[(rng_path.next() as usize) % group_s.len()]
                        };
                        current_word_bytes = (self.obfuscation_functions_v4[s_idx])(&current_word_bytes, Some(&func_key), &prng_factory)?;

                        // P: Permutation (Always randomized)
                        let p_idx = group_p[(rng_path.next() as usize) % group_p.len()];
                        current_word_bytes = (self.obfuscation_functions_v4[p_idx])(&current_word_bytes, Some(&func_key), &prng_factory)?;

                        // N: Network (V9 prioritizes MDS, Legacy uses Hill/GFMult)
                        let n_idx = if v >= 9 {
                            group_n[(rng_path.next() as usize) % group_n.len()]
                        } else {
                            if i % 4 == 1 {
                                8
                            } else if i % 4 == 3 {
                                7
                            } else {
                                group_n[(rng_path.next() as usize) % group_n.len()]
                            }
                        };
                        current_word_bytes = (self.obfuscation_functions_v4[n_idx])(&current_word_bytes, Some(&func_key), &prng_factory)?;

                        // A: Algebraic/AddKey (Always randomized)
                        let a_idx = group_a[(rng_path.next() as usize) % group_a.len()];
                        current_word_bytes = (self.obfuscation_functions_v4[a_idx])(&current_word_bytes, Some(&func_key), &prng_factory)?;
                    }
                } else {
                    for &func_index in &path {
                        let is_seeded = [4usize, 5, 6, 9].contains(&func_index);
                        let seed = if is_seeded { Some(func_key.as_slice()) } else { None };
                        let func = self.obfuscation_functions_v4[func_index];
                        current_word_bytes = func(&current_word_bytes, seed, &prng_factory)?;
                    }
                }

                let mut chain_input = chain_state.clone();
                chain_input.extend_from_slice(&current_word_bytes);
                chain_state = sha2::Sha256::digest(&chain_input).to_vec();

            } else {
                // Legacy V2-V5 path (unchanged)
                let mut selected_functions: Vec<usize> = (0..12).collect();
                let seed_for_selection = format!("{}{}{}", active_password_str, word, if v >= 5 { index.to_string() } else { "".to_string() });
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
                        cycle_depth = if v >= 5 { 12 + (depth_val % 501) } else { 12 + (depth_val % 53) };
                    }
                }
                let checksum = Self::generate_checksum(&selected_functions);
                let combined_seed = format!("{}{}{}", active_password_str, checksum, if v >= 5 { index.to_string() } else { "".to_string() }).into_bytes();
                let mut word_reverse_key = Vec::new();
                for i in 0..cycle_depth {
                    let mut func_index = selected_functions[i % selected_functions.len()];
                    if i >= 12 && !is_v4 && !is_v5 && (func_index == 2 || func_index == 3 || func_index == 8 || func_index == 9) {
                        func_index = (func_index + 2) % 12;
                    }
                    let is_seeded = if is_v4 || is_v5 { [4usize,5,6,9].contains(&func_index) } else { func_index >= 6 };
                    let seed = if is_seeded { Some(combined_seed.as_slice()) } else { None };
                    let func = if is_v4 || is_v5 { self.obfuscation_functions_v4[func_index] } else { self.obfuscation_functions_v2[func_index] };
                    current_word_bytes = func(&current_word_bytes, seed, &prng_factory)?;
                    word_reverse_key.push(func_index);
                }
                obfuscated_words.push(current_word_bytes);
                reverse_key.push(word_reverse_key);
                continue;
            }

            obfuscated_words.push(current_word_bytes);
        }

        let encoded_reverse_key = if v >= 6 { "".to_string() } else { Self::pack_reverse_key(&reverse_key, is_modern)? };

        let mut final_blob = Vec::new();
        for wb in &obfuscated_words {
            let l = wb.len();
            final_blob.push(((l >> 8) & 0xff) as u8);
            final_blob.push((l & 0xff) as u8);
            final_blob.extend(wb);
        }

        if final_blob.len() > 16384 {
            return Err(format!("Obfuscated payload exceeds 16384-byte limit ({} bytes)", final_blob.len()).into());
        }
        // V6: encrypt exact blob (no fixed padding needed - no RK correlation attack surface)
        // V1-V5: pad to fixed size to obscure word count from stored reverse key
        let final_payload: Vec<u8> = if v >= 6 {
            final_blob.clone()
        } else {
            let mut padded = vec![0u8; 16384];
            padded[..final_blob.len()].copy_from_slice(&final_blob);
            padded
        };

        let target_iterations = ITERATIONS_V2;
        let aad = if v >= 6 { None } else { Some(encoded_reverse_key.as_bytes()) };
        
        let mut mac_tag = String::new();
        let encrypted_content = if v >= 7 {
            // V7: Post-Quantum Purity (No AES)
            use hmac::{Hmac, Mac};
            type HmacSha256 = Hmac<sha2::Sha256>;
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&v7_hmac_key.unwrap())
                .map_err(|e| format!("HMAC error: {:?}", e))?;
            mac.update(&[v as u8]);
            mac.update(&ct_bytes_v7);
            mac.update(&final_payload);
            mac_tag = hex::encode(mac.finalize().into_bytes());
            hex::encode(&final_payload)
        } else {
            self.encrypt_aes256_gcm(&final_payload, &active_password_str, target_iterations, aad)?
        };

        let res_obj = serde_json::json!({
            "v": v,
            "data": encrypted_content,
            "ct": ct_hex,
            "mac": mac_tag
        });
        
        Ok(serde_json::json!({
            "encryptedData": res_obj.to_string(),
            "reverseKey": encoded_reverse_key
        }).to_string())
    }

    /// Decrypts the encrypted data back to the original mnemonic.
    fn decrypt(&self, encrypted_data_raw: &str, reverse_key_b64: &str, key_material: &str) -> Result<String, Box<dyn std::error::Error>> {
        // Parse version and payload fields
        let mut v: u32 = 2;
        let mut ct_hex = String::new();
        let mut encrypted_content = String::new();

        if let Ok(value) = serde_json::from_str::<serde_json::Value>(encrypted_data_raw) {
            if let Some(ver) = value["v"].as_u64() { v = ver as u32; }
            if let Some(ct) = value["ct"].as_str() { ct_hex = ct.to_string(); }
            if let Some(data) = value["data"].as_str() { encrypted_content = data.to_string(); }
        }
        if encrypted_content.is_empty() { encrypted_content = encrypted_data_raw.to_string(); }

        let is_modern = v >= 3;
        let is_v5 = v >= 5;
        let is_v6 = v >= 6;

        // Build reverse key (V1-V5 only; V6 is keyless/deterministic)
        let reverse_key: Vec<Vec<usize>> = if !is_v6 {
            let filtered_rk = clean_b64(reverse_key_b64);
            if let Ok(bytes) = general_purpose::STANDARD.decode(&filtered_rk) {
                if let Ok(rk) = serde_json::from_slice::<Vec<Vec<usize>>>(&bytes) { rk }
                else { Self::unpack_reverse_key(&filtered_rk, is_modern)? }
            } else {
                return Err("Invalid base64 in reverse key".into());
            }
        } else { Vec::new() };

        // ML-KEM-1024 decapsulation for V5+
        let mut active_password_str = key_material.to_string();
        let mut v7_hmac_key = None;
        let mut ct_bytes_raw = Vec::new();
        if v >= 5 {
            let sk_hex = clean_hex(key_material);
            let ct_hex_clean = clean_hex(&ct_hex);
            
            let sk_bytes: [u8; 3168] = hex::decode(&sk_hex)?
                .try_into().map_err(|_| "Invalid SK length")?;
            let ct_bytes: [u8; 1568] = hex::decode(&ct_hex_clean)?
                .try_into().map_err(|_| "Invalid CT length")?;
            ct_bytes_raw = ct_bytes.to_vec();
            let dk = DecapsulationKey::<MlKem1024Params>::from_bytes(&sk_bytes.into());
            let mut ss = dk.decapsulate(&ct_bytes.into())
                .map_err(|e| format!("ML-KEM failed: {:?}", e))?;
            let ss_bytes = ss.as_slice();

            if v >= 7 {
                use sha2::Digest;
                let mut hasher = sha2::Sha256::new();
                hasher.update(b"dkasp-v7-cipher-key");
                hasher.update(ss_bytes);
                active_password_str = hex::encode(hasher.finalize());
                
                let mut hasher = sha2::Sha256::new();
                hasher.update(b"dkasp-v7-hmac-key");
                hasher.update(ss_bytes);
                v7_hmac_key = Some(hasher.finalize().to_vec());
            } else {
                active_password_str = hex::encode(ss_bytes);
            }
            ss.zeroize();
        }

        // Decrypt Primary layer (AES or HMAC-V7)
        let aad = if v >= 6 { None } else { Some(reverse_key_b64.as_bytes()) };
        let full_blob: Vec<u8> = if v >= 7 {
            // V7: Integrity verify and bypass AES
            let payload_bytes = hex::decode(&encrypted_content)?;
            use hmac::Mac;
            type HmacSha256 = hmac::Hmac<sha2::Sha256>;
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&v7_hmac_key.unwrap())
                .map_err(|e| format!("HMAC error: {:?}", e))?;
            mac.update(&[v as u8]);
            mac.update(&ct_bytes_raw);
            mac.update(&payload_bytes);
            
            let expected_mac_hex = if let Ok(value) = serde_json::from_str::<serde_json::Value>(encrypted_data_raw) {
                value["mac"].as_str().unwrap_or("").to_string()
            } else { "".to_string() };
            let expected_mac = hex::decode(expected_mac_hex)?;
            
            if mac.verify_slice(&expected_mac).is_err() {
                return Err("D-KASP V7: Integrity Check Failed (MAC mismatch)".into());
            }
            payload_bytes
        } else if is_modern {
            let dec = self.decrypt_aes256_gcm(&encrypted_content, &active_password_str, ITERATIONS_V2, aad)?;
            if v >= 5 { dec } else {
                let s = std::str::from_utf8(&dec)?;
                general_purpose::STANDARD.decode(s.trim())?
            }
        } else {
            let dec = self.decrypt_aes256(&encrypted_content, &active_password_str, ITERATIONS_V2)?;
            let s = std::str::from_utf8(&dec)?;
            general_purpose::STANDARD.decode(s.trim())?
        };

        // De-obfuscation loop
        use sha2::Digest;
        let prng_factory = |s: &str| ActivePRNG::new(s, is_modern);
        // Fix 2: Chain state for decrypt (V6 only) — must match encrypt init
        let mut v6_chain_state: Vec<u8> = if is_v6 {
            sha2::Sha256::digest(format!("dkasp-chain-v6{}", active_password_str).as_bytes()).to_vec()
        } else { Vec::new() };
        let mut deobfuscated_words = Vec::new();
        let mut offset = 0;
        let mut word_index = 0;

        while offset < full_blob.len() {
            if !is_v6 && word_index >= reverse_key.len() { break; }
            if offset + 2 > full_blob.len() { break; }
            let len = ((full_blob[offset] as usize) << 8) | (full_blob[offset + 1] as usize);
            offset += 2;
            if offset + len > full_blob.len() { break; }
            let mut current_word_bytes = full_blob[offset..offset + len].to_vec();
            offset += len;

            if is_v6 {
                // Fix 1: HMAC key schedule — derive per-word subkey
                use hmac::Mac;
                type HmacSha256 = hmac::Hmac<sha2::Sha256>;
                let word_key: Vec<u8> = {
                    let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(active_password_str.as_bytes())
                        .map_err(|e| format!("HMAC error: {:?}", e))?;
                    mac.update(format!("dkasp-v6-word-{}", word_index).as_bytes());
                    mac.finalize().into_bytes().to_vec()
                };
                let word_key_hex = hex::encode(&word_key);

                // Fix 4: Regenerate sanitised path (same logic as encrypt)
                let mut rng_path = prng_factory(&word_key_hex);
                let hash = sha2::Sha256::digest(word_key_hex.as_bytes());
                let depth = 12 + (usize::from_str_radix(&hex::encode(hash)[..4], 16).unwrap_or(0) % 501);
                let mut path: Vec<usize> = Vec::with_capacity(depth);
                let mut last_three = [99usize; 3];
                for _ in 0..depth {
                    let mut fi = (rng_path.next() as usize) % 12;
                    if last_three[0] == fi && last_three[1] == fi && last_three[2] == fi {
                        fi = (fi + 1 + (rng_path.next() as usize % 11)) % 12;
                    }
                    last_three[0] = last_three[1]; last_three[1] = last_three[2]; last_three[2] = fi;
                    path.push(fi);
                }
                // Ensure min 6 distinct in first 12 slots (fix 4b)
                {
                    let path_clone = path[..12.min(path.len())].to_vec();
                    let distinct: std::collections::HashSet<usize> = path_clone.iter().cloned().collect();
                    if distinct.len() < 6 {
                        let missing: Vec<usize> = (0..12).filter(|x| !distinct.contains(x)).collect();
                        let mut mi = 0;
                        for i in 0..12.min(path.len()) {
                            let count = path_clone.iter().filter(|&&x| x == path[i]).count();
                            if count > 2 && mi < missing.len() {
                                path[i] = missing[mi]; mi += 1;
                            }
                        }
                    }
                }

                // Fix 1: Derive combined seed via HMAC
                let checksum = Self::generate_checksum(&(0..12).collect::<Vec<_>>());
                let func_key: Vec<u8> = {
                    let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&word_key)
                        .map_err(|e| format!("HMAC error: {:?}", e))?;
                    mac.update(format!("keyed-{}", checksum).as_bytes());
                    mac.finalize().into_bytes().to_vec()
                };

                if v >= 8 {
                    // V8: Inverse SPNA Structured Gauntlet
                    let mut rng_path = prng_factory(&word_key_hex);
                    let group_s = [0usize, 1, 5];
                    let group_p = [2usize, 3, 10];
                    let group_n = if v >= 9 { [12usize, 12, 11] } else { [7usize, 8, 11] };
                    let group_a = [4usize, 6, 9];

                    let mut round_paths = Vec::with_capacity(16);
                    for i in 0..16 {
                        // S: Substitution
                        let s = if i % 4 == 0 { 0 } else if i % 4 == 2 { 1 } else { group_s[(rng_path.next() as usize) % group_s.len()] };
                        
                        // P: Permutation
                        let p = group_p[(rng_path.next() as usize) % group_p.len()];
                        
                        // N: Network (V9 prioritizes MDS)
                        let n = if v >= 9 {
                            group_n[(rng_path.next() as usize) % group_n.len()]
                        } else {
                            if i % 4 == 1 { 8 } else if i % 4 == 3 { 7 } else { group_n[(rng_path.next() as usize) % group_n.len()] }
                        };
                        
                        // A: Algebraic
                        let a = group_a[(rng_path.next() as usize) % group_a.len()];
                        round_paths.push((s, p, n, a));
                    }

                    for j in (0..16).rev() {
                        let (s, p, n, a) = round_paths[j];
                        // Inverse Order: A -> N -> P -> S
                        current_word_bytes = (self.deobfuscation_functions_v4[a])(&current_word_bytes, Some(&func_key), &prng_factory)?;
                        current_word_bytes = (self.deobfuscation_functions_v4[n])(&current_word_bytes, Some(&func_key), &prng_factory)?;
                        current_word_bytes = (self.deobfuscation_functions_v4[p])(&current_word_bytes, Some(&func_key), &prng_factory)?;
                        current_word_bytes = (self.deobfuscation_functions_v4[s])(&current_word_bytes, Some(&func_key), &prng_factory)?;
                    }
                } else {
                    // Apply inverse transforms in reverse order
                    for &func_index in path.iter().rev() {
                        let is_seeded = [4usize, 5, 6, 9].contains(&func_index);
                        let seed = if is_seeded { Some(func_key.as_slice()) } else { None };
                        let func = self.deobfuscation_functions_v4[func_index];
                        current_word_bytes = func(&current_word_bytes, seed, &prng_factory)?;
                    }
                }

                // Fix 2: Capture cipher bytes for chain advance, then undo chain XOR
                // cipher_bytes = bytes as read from full_blob (before deobfuscation)
                let cipher_bytes = full_blob[offset - len..offset].to_vec();
                // Undo the chain pre-XOR that was applied during encryption
                for (i, b) in current_word_bytes.iter_mut().enumerate() {
                    *b ^= v6_chain_state[i % 32];
                }
                // Advance chain from cipher bytes (same as encrypt path)
                let mut chain_input = v6_chain_state.clone();
                chain_input.extend_from_slice(&cipher_bytes);
                v6_chain_state = sha2::Sha256::digest(&chain_input).to_vec();

                if let Ok(word) = String::from_utf8(current_word_bytes) {
                    deobfuscated_words.push(word);
                }
            } else {
                // Legacy V2-V5 path
                let word_path = reverse_key[word_index].clone();
                let mut unique = word_path.clone(); unique.sort(); unique.dedup();
                let checksum = Self::generate_checksum(&unique);
                let idx_str = if v >= 5 { word_index.to_string() } else { String::new() };
                let combined_seed = format!("{}{}{}", active_password_str, checksum, idx_str).into_bytes();
                for &func_index in word_path.iter().rev() {
                    let is_seeded = if v >= 4 { [4usize, 5, 6, 9].contains(&func_index) } else { func_index >= 6 };
                    let seed = if is_seeded { Some(combined_seed.as_slice()) } else { None };
                    let func = if v >= 4 { self.deobfuscation_functions_v4[func_index] } else { self.deobfuscation_functions_v2[func_index] };
                    current_word_bytes = func(&current_word_bytes, seed, &prng_factory)?;
                }
                if let Ok(word) = String::from_utf8(current_word_bytes) {
                    deobfuscated_words.push(word);
                }
            }
            word_index += 1;
        }

        Ok(deobfuscated_words.join(" "))
    }


    /*
    fn encrypt_aes256(&self, data: &str, password: &str, iterations: u32) -> Result<String, Box<dyn std::error::Error>> {
...
        Ok(format!("{}{}{}", salt_hex, iv_hex, cipher_b64))
    }
    */

    fn encrypt_aes256_gcm(&self, data: &[u8], password: &str, iterations: u32, aad: Option<&[u8]>) -> Result<String, Box<dyn std::error::Error>> {
        let mut salt = [0u8; SALT_SIZE_BYTES];
        rand::thread_rng().fill(&mut salt);
        
        let mut key = [0u8; KEY_SIZE];
        pbkdf2::<Hmac<Sha256>>(password.as_bytes(), &salt, iterations, &mut key)?;

        let mut iv_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut iv_bytes);

        let cipher = Aes256Gcm::new(key.as_slice().into());
        let nonce = Nonce::from_slice(&iv_bytes); 

        let ciphertext = if let Some(ad) = aad {
            cipher.encrypt(nonce, Payload { msg: data, aad: ad })
                .map_err(|e| format!("AES GCM Encryption error: {:?}", e))?
        } else {
            cipher.encrypt(nonce, data)
                .map_err(|e| format!("AES GCM Encryption error: {:?}", e))?
        };

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
        let plaintext = Aes256CbcDec::new(&key.into(), iv_arr)
            .decrypt_padded_mut::<Pkcs7>(&mut ciphertext)
            .map_err(|e| format!("CBC Decryption/Unpad error: {:?}", e))?
            .to_vec();

        key.zeroize();

        Ok(plaintext)
    }

    fn decrypt_aes256_gcm(&self, transit_message: &str, password: &str, iterations: u32, aad: Option<&[u8]>) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        if transit_message.len() < 56 { return Err("Invalid message length".into()); }
        let salt_hex = &transit_message[..32];
        let iv_hex = &transit_message[32..56]; 
        let encrypted_base64 = &transit_message[56..];

        let salt = hex::decode(salt_hex)?;
        let iv_bytes = hex::decode(iv_hex)?;
        let ciphertext = general_purpose::STANDARD.decode(encrypted_base64)?;

        let mut key = [0u8; KEY_SIZE];
        pbkdf2::<Hmac<Sha256>>(password.as_bytes(), &salt, iterations, &mut key)?;

        let cipher = Aes256Gcm::new(key.as_slice().into());
        let nonce = Nonce::from_slice(&iv_bytes);

        let plaintext = if let Some(ad) = aad {
            cipher.decrypt(nonce, Payload { msg: &ciphertext, aad: ad })
                .map_err(|e| format!("AES GCM Decryption error: {:?}", e))?
        } else {
            cipher.decrypt(nonce, ciphertext.as_slice())
                .map_err(|e| format!("AES GCM Decryption error: {:?}", e))?
        };

        key.zeroize();

        Ok(plaintext)
    }
}

fn print_usage() {
    println!("Usage: darkstar [flags] <command> [args]");
    println!("Flags:");
    println!("  -v, --v <1-5>       Protocol version (default: 5)");
    println!("  -f, --format <fmt>  Output format (json, csv, text)");
    println!("Commands:");
    println!("  encrypt <mnemonic> <password>");
    println!("  decrypt <data> <rk> <password>");
    println!("  keygen              Generate ML-KEM-1024 keys");
    println!("  test                Run self-test");
}

fn resolve_arg(arg: &str) -> String {
    if arg.starts_with('@') {
        let path = &arg[1..];
        match fs::read_to_string(path) {
            Ok(content) => content, // Return raw, will be cleaned at call site if dense
            Err(e) => {
                eprintln!("Error reading argument file {}: {}", path, e);
                std::process::exit(1);
            }
        }
    } else {
        arg.to_string()
    }
}

fn clean_hex(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_hexdigit()).collect()
}

fn clean_b64(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '+' || *c == '/' || *c == '=').collect()
}

fn main() {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let mut v = 5;
    let mut output_format = "json".to_string();

    while !args.is_empty() && args[0].starts_with('-') {
        let arg = args.remove(0);
        match arg.as_str() {
            "-v" | "--v" => {
                if !args.is_empty() { v = args.remove(0).parse().unwrap_or(5); }
            },
            "-f" | "--format" => {
                if !args.is_empty() { output_format = args.remove(0); }
            },
            _ => {}
        }
    }

    if args.is_empty() {
        print_usage();
        return;
    }

    let command = args.remove(0);
    let dc = DarkstarCrypt::new();

    match command.as_str() {
        "encrypt" => {
            if args.len() < 2 { print_usage(); return; }
            let mnemonic_owned = resolve_arg(&args[0]);
            let password_owned = resolve_arg(&args[1]);
            let mnemonic = &mnemonic_owned;
            let password = &password_owned;

            match dc.encrypt(mnemonic, password, v) {
                Ok(res_json) => {
                    if output_format == "csv" {
                        let j: serde_json::Value = serde_json::from_str(&res_json).unwrap();
                        let inner: serde_json::Value = serde_json::from_str(j["encryptedData"].as_str().unwrap()).unwrap();
                        println!("{},{}", inner["v"], j["reverseKey"]);
                    } else if output_format == "text" {
                        let j: serde_json::Value = serde_json::from_str(&res_json).unwrap();
                        println!("Encrypted: {}\nRK: {}", j["encryptedData"], j["reverseKey"]);
                    } else {
                        println!("{}", res_json);
                    }
                },
                Err(e) => {
                    eprintln!("Encryption Failed: {} (Arg length: {}, pass snippet: {:?})", e, password.len(), &password[..20.min(password.len())]);
                    std::process::exit(1);
                }
            }
        },
        "decrypt" => {
            if args.len() < 3 { print_usage(); return; }
            let data_owned = resolve_arg(&args[0]);
            let rk_owned = resolve_arg(&args[1]);
            let password_owned = resolve_arg(&args[2]);
            let data = &data_owned;
            let rk = &rk_owned;
            let password = &password_owned;

            match dc.decrypt(data, rk, password) {
                Ok(decrypted) => println!("{}", decrypted),
                Err(e) => {
                    eprintln!("Decryption Failed: {} (RK length: {}, Data length: {})", e, rk.len(), data.len());
                    std::process::exit(1);
                }
            }
        },
        "keygen" => {
            let (ek, dk) = MlKem1024::generate(&mut rand::thread_rng());
            println!("PK: {}", hex::encode(ek.as_bytes()));
            println!("SK: {}", hex::encode(dk.as_bytes()));
        },
        "test" => {
            let mnemonic = "apple banana cherry date elderberry fig grape honeydew";
            let mut password = "password123".to_string();
            let mut dec_psw = password.clone();

            if v >= 5 {
                let (ek, dk) = MlKem1024::generate(&mut rand::thread_rng());
                password = hex::encode(ek.as_bytes());
                dec_psw = hex::encode(dk.as_bytes());
            }

            println!("--- Darkstar Rust Self-Test (V{}) ---", v);
            match dc.encrypt(mnemonic, &password, v) {
                Ok(res_json) => {
                    let res: serde_json::Value = serde_json::from_str(&res_json).unwrap();
                    let enc_owned = match res["encryptedData"].as_str() {
                        Some(s) => s.to_string(),
                        None => res["encryptedData"].to_string(),
                    };
                    let enc = &enc_owned;
                    let rk = res["reverseKey"].as_str().unwrap();

                    match dc.decrypt(enc, rk, &dec_psw) {
                        Ok(decrypted) => {
                            println!("Decrypted: '{}'", decrypted);
                            if decrypted == mnemonic {
                                println!("Result: PASSED");
                            } else {
                                println!("Result: FAILED");
                                std::process::exit(1);
                            }
                        },
                        Err(e) => {
                            eprintln!("Test Decryption Failed: {}", e);
                            std::process::exit(1);
                        }
                    }
                },
                Err(e) => {
                    eprintln!("Test Encryption Failed: {}", e);
                    std::process::exit(1);
                }
            }
        },
        _ => {
            eprintln!("Error: Unknown command '{}'", command);
            print_usage();
            std::process::exit(1);
        }
    }
}
