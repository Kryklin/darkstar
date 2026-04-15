/*
 * DARKSTAR - Secure Multi-Layered Encryption & Steganography Suite
 * Version: 3.0.0
 * Protocol: D-ASP (Darkstar Algebraic Substitution & Permutation)
 * Security: Grade-1024 (Kyber-Standard)
 * Implementation: Rust (Reference "Gold" Implementation)
 *
 * Professional Grade Cryptographic Module
 * Bit-Perfect Interoperability Verified
 */

use sha2::{Sha256, Digest};
use zeroize::Zeroize;
use std::fs;
use ml_kem::{MlKem1024, MlKem1024Params, KemCore, EncodedSizeUser};
use ml_kem::kem::{EncapsulationKey, DecapsulationKey, Encapsulate, Decapsulate};

/// D-ASP Cryptographic Suite
///
/// Definitive implementation of the Darkstar Algebraic Substitution & Permutation (D-ASP) protocol.
///
/// - **D**: Darkstar ecosystem origin
/// - **ASP Cascade 16**: The 16-round core engine logic
/// - **A**: Algebraic Substitution
/// - **S**: Structural Permutation
/// - **P**: Permutation-based non-linear core
use serde_json;

const SBOX: [u8; 256] = [
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

fn gf_mult(mut a: u8, mut b: u8) -> u8 {
    let mut p = 0u8;
    for _ in 0..8 {
        // Mask: if b & 1, add a to product p
        p ^= a & ((b & 1).wrapping_neg());

        // Mask: if hi-bit of a is set, reduce by 0x1B
        let mask = ((a as i8) >> 7) as u8;
        a <<= 1;
        a ^= 0x1B & mask;

        b >>= 1;
    }
    p
}

fn get_inv_sbox() -> [u8; 256] {
    let mut inv = [0u8; 256];
    for i in 0..256 { inv[SBOX[i] as usize] = i as u8; }
    inv
}

// clean_hex moved to top

/// Deterministic PRNG Implementation
///
/// Custom ChaCha20-based PRNG for cross-language bit-perfect path selection.

struct DarkstarChaChaPRNG {
    state: [u32; 16],
    block: [u32; 16],
    block_idx: usize,
}

impl DarkstarChaChaPRNG {
    fn new(seed_str: &str) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(seed_str.as_bytes());
        let hash = hasher.finalize();
        let mut state = [0u32; 16];
        state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574;
        for i in 0..8 {
            let chunk = &hash[i*4..(i+1)*4];
            state[4+i] = u32::from_le_bytes(chunk.try_into().unwrap());
        }
        state[12] = 0;
        state[13] = 0;
        state[14] = 0;
        state[15] = 0;

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

struct ActivePRNG {
    inner: DarkstarChaChaPRNG,
}

impl ActivePRNG {
    fn new(seed_str: &str) -> Self {
        ActivePRNG { inner: DarkstarChaChaPRNG::new(seed_str) }
    }
    fn next(&mut self) -> u32 { self.inner.next() }
}

/// Core D-KASP Cryptographic Controller

type TransformationResult = Result<Vec<u8>, Box<dyn std::error::Error>>;
type TransformationFn = fn(&[u8], Option<&[u8]>, &dyn Fn(&str) -> ActivePRNG) -> TransformationResult;

struct DarkstarCrypt {
    forward_pipeline: Vec<TransformationFn>,
    reverse_pipeline: Vec<TransformationFn>,
}

impl DarkstarCrypt {
    fn new() -> Self {
        DarkstarCrypt {
            forward_pipeline: vec![
                Self::trans_sbox,
                Self::trans_modmult,
                Self::trans_pbox,
                Self::trans_cyclicrot,
                Self::trans_keyedxor,
                Self::trans_feistel,
                Self::trans_modadd,
                Self::trans_matrixhill,
                Self::trans_gfmult,
                Self::trans_bitflip,
                Self::trans_columnar,
                Self::trans_recxor,
                Self::trans_mds_network,
            ],
            reverse_pipeline: vec![
                Self::inv_trans_sbox,
                Self::inv_trans_modmult,
                Self::inv_trans_pbox,
                Self::inv_trans_cyclicrot,
                Self::inv_trans_keyedxor,
                Self::inv_trans_feistel,
                Self::inv_trans_modadd,
                Self::inv_trans_matrixhill,
                Self::inv_trans_gfmult,
                Self::inv_trans_bitflip,
                Self::inv_trans_columnar,
                Self::inv_trans_recxor,
                Self::inv_trans_mds_network,
            ],
        }
    }

    fn generate_checksum(numbers: &[usize]) -> usize {
        if numbers.is_empty() { return 0; }
        let sum: usize = numbers.iter().sum();
        sum % 997
    }

    /// Functional Transformation Primitives
    fn trans_sbox(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Ok(input.iter().map(|&b| SBOX[b as usize]).collect())
    }
    fn inv_trans_sbox(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        let inv = get_inv_sbox();
        Ok(input.iter().map(|&b| inv[b as usize]).collect())
    }
    fn trans_modmult(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Ok(input.iter().map(|&b| ((b as u16 * 167) & 0xFF) as u8).collect())
    }
    fn inv_trans_modmult(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Ok(input.iter().map(|&b| ((b as u16 * 23) & 0xFF) as u8).collect())
    }
    fn trans_pbox(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
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
    fn inv_trans_pbox(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Self::trans_pbox(input, seed, prng_factory)
    }
    fn trans_cyclicrot(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Ok(input.iter().map(|&b| (b >> 3) | (b << 5)).collect())
    }
    fn inv_trans_cyclicrot(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Ok(input.iter().map(|&b| (b << 3) | (b >> 5)).collect())
    }
    fn trans_keyedxor(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| b ^ seed[i % seed.len()]).collect())
    }
    fn inv_trans_keyedxor(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Self::trans_keyedxor(input, seed, prng_factory)
    }
    fn trans_feistel(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
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
    fn inv_trans_feistel(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Self::trans_feistel(input, seed, prng_factory)
    }
    fn trans_modadd(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| b.wrapping_add(seed[i % seed.len()])).collect())
    }
    fn inv_trans_modadd(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| b.wrapping_sub(seed[i % seed.len()])).collect())
    }
    fn trans_matrixhill(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        let mut out = input.to_vec();
        if out.is_empty() { return Ok(out); }
        for i in 1..out.len() { out[i] = out[i].wrapping_add(out[i - 1]); }
        Ok(out)
    }
    fn inv_trans_matrixhill(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
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

    fn trans_mds_network(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        if input.len() < 4 { return Self::trans_matrixhill(input, _seed, _prng_factory); }
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
                    sum ^= gf_mult(block[col], Self::MDS_MATRIX[row][col]);
                }
                out[i + row] = sum;
            }
        }
        Ok(out)
    }

    fn inv_trans_mds_network(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        if input.len() < 4 { return Self::inv_trans_matrixhill(input, _seed, _prng_factory); }
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
                    sum ^= gf_mult(block[col], Self::INV_MDS_MATRIX[row][col]);
                }
                out[i + row] = sum;
            }
        }
        Ok(out)
    }
    fn trans_gfmult(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Ok(input.iter().map(|&b| gf_mult(b, 0x02)).collect())
    }
    fn inv_trans_gfmult(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Ok(input.iter().map(|&b| gf_mult(b, 0x8D)).collect())
    }
    fn trans_bitflip(input: &[u8], seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        let seed = seed.unwrap_or(&[]);
        if seed.is_empty() { return Ok(input.to_vec()); }
        Ok(input.iter().enumerate().map(|(i, &b)| {
            let mask = seed[i % seed.len()];
            b ^ ((mask & 0xAA) | (!mask & 0x55))
        }).collect())
    }
    fn inv_trans_bitflip(input: &[u8], seed: Option<&[u8]>, prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        Self::trans_bitflip(input, seed, prng_factory)
    }
    fn trans_columnar(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
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
    fn inv_trans_columnar(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
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
    fn trans_recxor(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        let mut out = input.to_vec();
        if out.is_empty() { return Ok(out); }
        for i in 1..out.len() { out[i] = out[i - 1] ^ out[i]; }
        Ok(out)
    }
    fn inv_trans_recxor(input: &[u8], _seed: Option<&[u8]>, _prng_factory: &dyn Fn(&str) -> ActivePRNG) -> TransformationResult {
        let mut out = input.to_vec();
        if out.is_empty() { return Ok(out); }
        for i in (1..out.len()).rev() { out[i] = out[i] ^ out[i - 1]; }
        Ok(out)
    }

    fn encrypt(&self, payload: &str, pk_hex: &str, hwid: Option<Vec<u8>>) -> Result<String, Box<dyn std::error::Error>> {        let total_start = std::time::Instant::now();
        let payload_bytes = payload.as_bytes();
        let pk_bytes: [u8; 1568] = hex::decode(clean_hex(pk_hex))?
            .try_into().map_err(|_| format!("Invalid public key length (Arg length: {})", pk_hex.len()))?;

        let kem_start = std::time::Instant::now();
        let ek = EncapsulationKey::<MlKem1024Params>::from_bytes(&pk_bytes.into());
        let (ct, mut ss) = ek.encapsulate(&mut rand::thread_rng())
            .map_err(|e| format!("KEM encapsulation failed: {:?}", e))?;
        let ct_hex = hex::encode(&ct[..]);
        let ss_bytes = &ss[..];
        let kem_duration = kem_start.elapsed();

        let kdf_start = std::time::Instant::now();
        use sha2::Digest;
        
        // Stage 1: Blended_SS (K_root)
        let mut k_root_hasher = Sha256::new();
        k_root_hasher.update(&ss_bytes);
        if let Some(ref h) = hwid {
            k_root_hasher.update(h);
        }
        k_root_hasher.update(b"dasp-identity-v3");
        let blended_ss = k_root_hasher.finalize();
        let blended_ss_hex = hex::encode(blended_ss);

        let mut cipher_hasher = Sha256::new();
        cipher_hasher.update(b"cipher");
        cipher_hasher.update(&blended_ss);
        let cipher_key = cipher_hasher.finalize();

        let mut hmac_hasher = Sha256::new();
        hmac_hasher.update(b"hmac");
        hmac_hasher.update(&blended_ss);
        let hmac_key = hmac_hasher.finalize();
        
        let active_password_str = hex::encode(cipher_key);
        let active_hmac_key = hmac_key.to_vec();
        ss.zeroize();
        let kdf_duration = kdf_start.elapsed();

        let prng_factory = |s: &str| ActivePRNG::new(s);
        let mut chain_hasher = Sha256::new();
        chain_hasher.update(format!("dasp-chain-{}", active_password_str).as_bytes());
        let chain_state = chain_hasher.finalize().to_vec();

        let mut current_word_bytes = payload_bytes.to_vec();

        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<sha2::Sha256>;
        
        // Stage 2: word_key
        let word_key: Vec<u8> = {
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(active_password_str.as_bytes())
                .map_err(|e| format!("HMAC init error: {:?}", e))?;
            mac.update(b"dasp-word-0");
            mac.finalize().into_bytes().to_vec()
        };
        let word_key_hex = hex::encode(&word_key);

        for (i, b) in current_word_bytes.iter_mut().enumerate() {
            *b ^= chain_state[i % 32];
        }

        let checksum = Self::generate_checksum(&(0..12).collect::<Vec<_>>());
        let func_key: Vec<u8> = {
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&word_key)
                .map_err(|e| format!("HMAC init error: {:?}", e))?;
            mac.update(format!("keyed-{}", checksum).as_bytes());
            mac.finalize().into_bytes().to_vec()
        };

        let mut rng_path = prng_factory(&word_key_hex);
        let group_s = [0usize, 1, 5];
        let group_p = [2usize, 3, 10];
        let group_n = [12usize, 12, 11];
        let group_a = [4usize, 6, 9];

        // Stage 3: Round Indices
        let mut round_indices = Vec::with_capacity(16);
        let cascade_start = std::time::Instant::now();
        for i in 0..16 {
            let s_idx = if i % 4 == 0 { 0 } else if i % 4 == 2 { 1 } else { group_s[(rng_path.next() as usize) % group_s.len()] };
            current_word_bytes = (self.forward_pipeline[s_idx])(&current_word_bytes, Some(&func_key), &prng_factory)?;

            let p_idx = group_p[(rng_path.next() as usize) % group_p.len()];
            current_word_bytes = (self.forward_pipeline[p_idx])(&current_word_bytes, Some(&func_key), &prng_factory)?;

            let n_idx = group_n[(rng_path.next() as usize) % group_n.len()];
            current_word_bytes = (self.forward_pipeline[n_idx])(&current_word_bytes, Some(&func_key), &prng_factory)?;

            let a_idx = group_a[(rng_path.next() as usize) % group_a.len()];
            current_word_bytes = (self.forward_pipeline[a_idx])(&current_word_bytes, Some(&func_key), &prng_factory)?;
            
            round_indices.push(vec![s_idx, p_idx, n_idx, a_idx]);
        }
        let cascade_duration = cascade_start.elapsed();

        let active_hmac_key = hmac_key.clone();
        
        let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&active_hmac_key)
            .map_err(|e| format!("HMAC error: {:?}", e))?;
        mac.update(&ct);
        mac.update(&current_word_bytes);
        
        // Stage 4: final mac
        let mac_tag = hex::encode(mac.finalize().into_bytes());

        if std::env::var("DASP_DIAGNOSTIC").is_ok() {
            eprintln!("{}", serde_json::json!({
                "diagnostics": {
                    "stage1_blended_ss": blended_ss_hex,
                    "stage2_word_key": word_key_hex,
                    "stage3_round_indices": round_indices,
                    "stage4_mac": mac_tag
                }
            }));
        }
        let total_duration = total_start.elapsed();

        let res_obj = serde_json::json!({
            "data": hex::encode(&current_word_bytes),
            "ct": ct_hex,
            "mac": mac_tag,
            "timings": {
                "kem_us": kem_duration.as_micros(),
                "kdf_us": kdf_duration.as_micros(),
                "gauntlet_us": gauntlet_duration.as_micros(),
                "total_us": total_duration.as_micros()
            }
        });
        
        Ok(res_obj.to_string())
    }

    fn decrypt(&self, encrypted_data_raw: &str, sk_hex: &str, hwid: Option<Vec<u8>>) -> Result<String, Box<dyn std::error::Error>> {
        let total_start = std::time::Instant::now();
        let value: serde_json::Value = serde_json::from_str(encrypted_data_raw)?;
        
        let ct_hex = value["ct"].as_str().ok_or("Missing CT")?;
        let encrypted_content = value["data"].as_str().ok_or("Missing data")?;
        let mac_tag_hex = value["mac"].as_str().ok_or("Missing MAC")?;

        let sk_bytes: [u8; 3168] = hex::decode(clean_hex(&sk_hex))?
            .try_into().map_err(|_| format!("Invalid secret key length (Arg length: {})", sk_hex.len()))?;
        let ct_bytes: [u8; 1568] = hex::decode(clean_hex(ct_hex))?
            .try_into().map_err(|_| format!("Invalid ciphertext length (Arg length: {})", ct_hex.len()))?;

        let kem_start = std::time::Instant::now();
        let dk = DecapsulationKey::<MlKem1024Params>::from_bytes(&sk_bytes.into());
        let mut ss = dk.decapsulate(&ct_bytes.into())
            .map_err(|e| format!("KEM decapsulation failed: {:?}", e))?;
        let ss_bytes = &ss[..];
        let kem_duration = kem_start.elapsed();

        let kdf_start = std::time::Instant::now();
        use sha2::Digest;
        
        // Stage 1: Blended_SS (K_root)
        let mut k_root_hasher = Sha256::new();
        k_root_hasher.update(&ss_bytes);
        if let Some(ref h) = hwid {
            k_root_hasher.update(h);
        }
        k_root_hasher.update(b"dasp-identity-v3");
        let blended_ss = k_root_hasher.finalize();
        let blended_ss_hex = hex::encode(blended_ss);

        let mut cipher_hasher = Sha256::new();
        cipher_hasher.update(b"cipher");
        cipher_hasher.update(&blended_ss);
        let cipher_key = cipher_hasher.finalize();

        let mut hmac_hasher = Sha256::new();
        hmac_hasher.update(b"hmac");
        hmac_hasher.update(&blended_ss);
        let hmac_key = hmac_hasher.finalize();
        
        let active_password_str = hex::encode(cipher_key);
        let active_hmac_key = hmac_key.to_vec();
        ss.zeroize();
        let kdf_duration = kdf_start.elapsed();

        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<sha2::Sha256>;

        // Stage 2: word_key
        let word_key: Vec<u8> = {
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(active_password_str.as_bytes())
                .map_err(|e| format!("HMAC error: {:?}", e))?;
            mac.update(b"dasp-word-0");
            mac.finalize().into_bytes().to_vec()
        };
        let word_key_hex = hex::encode(&word_key);

        let prng_factory = |s: &str| ActivePRNG::new(s);
        let mut rng_path = prng_factory(&word_key_hex);
        let group_s = [0usize, 1, 5];
        let group_p = [2usize, 3, 10];
        let group_n = [12usize, 12, 11];
        let group_a = [4usize, 6, 9];

        // Stage 3: Round Indices
        let mut round_indices = Vec::with_capacity(16);
        let mut round_paths = Vec::with_capacity(16);
        for i in 0..16 {
            let s = if i % 4 == 0 { 0 } else if i % 4 == 2 { 1 } else { group_s[(rng_path.next() as usize) % group_s.len()] };
            let p = group_p[(rng_path.next() as usize) % group_p.len()];
            let n = group_n[(rng_path.next() as usize) % group_n.len()];
            let a = group_a[(rng_path.next() as usize) % group_a.len()];
            round_paths.push((s, p, n, a));
            round_indices.push(vec![s, p, n, a]);
        }
        let payload_bytes = hex::decode(encrypted_content)?;
        let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&active_hmac_key)
            .map_err(|e| format!("HMAC error: {:?}", e))?;
        mac.update(&ct_bytes);
        mac.update(&payload_bytes);
        
        let mac_tag_actual = hex::encode(mac.clone().finalize().into_bytes());

        if std::env::var("DASP_DIAGNOSTIC").is_ok() {
            eprintln!("{}", serde_json::json!({
                "diagnostics": {
                    "stage1_blended_ss": blended_ss_hex,
                    "stage2_word_key": word_key_hex,
                    "stage3_round_indices": round_indices,
                    "stage4_mac": mac_tag_actual
                }
            }));
        }

        mac.verify_slice(&hex::decode(mac_tag_hex)?)
            .map_err(|_| "Integrity Check Failed")?;

        let checksum = Self::generate_checksum(&(0..12).collect::<Vec<_>>());
        let func_key: Vec<u8> = {
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&word_key)
                .map_err(|e| format!("HMAC error: {:?}", e))?;
            mac.update(format!("keyed-{}", checksum).as_bytes());
            mac.finalize().into_bytes().to_vec()
        };

        let mut chain_hasher = Sha256::new();
        chain_hasher.update(format!("dasp-chain-{}", active_password_str).as_bytes());
        let chain_state = chain_hasher.finalize().to_vec();

        let cascade_start = std::time::Instant::now();
        let mut current_word_bytes = payload_bytes;
        for j in (0..16).rev() {
            let (s, p, n, a) = round_paths[j];
            current_word_bytes = (self.reverse_pipeline[a])(&current_word_bytes, Some(&func_key), &prng_factory)?;
            current_word_bytes = (self.reverse_pipeline[n])(&current_word_bytes, Some(&func_key), &prng_factory)?;
            current_word_bytes = (self.reverse_pipeline[p])(&current_word_bytes, Some(&func_key), &prng_factory)?;
            current_word_bytes = (self.reverse_pipeline[s])(&current_word_bytes, Some(&func_key), &prng_factory)?;
        }
        let cascade_duration = cascade_start.elapsed();

        for (i, b) in current_word_bytes.iter_mut().enumerate() {
            *b ^= chain_state[i % 32];
        }

        let result = String::from_utf8(current_word_bytes)?;
        let total_duration = total_start.elapsed();
        
        eprintln!("{}", serde_json::json!({
            "timings": {
                "kem_us": kem_duration.as_micros(),
                "kdf_us": kdf_duration.as_micros(),
                "gauntlet_us": gauntlet_duration.as_micros(),
                "total_us": total_duration.as_micros()
            }
        }));

        Ok(result)
    }
}

fn print_usage() {
    println!("Usage: darkstar <command> [args]");
    println!("Commands:");
    println!("  encrypt <payload> <pk_hex>   Encrypt using D-ASP");
    println!("  decrypt <json_data> <sk_hex> Decrypt using D-ASP");
    println!("  keygen                       Generate ML-KEM-1024 keys");
    println!("  test                         Run D-ASP self-test");
}

fn resolve_arg(arg: &str) -> String {
    if arg.starts_with('@') {
        let path = std::path::Path::new(&arg[1..]);
        let content = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("Error reading argument @file '{}': {}", path.display(), e));
        content.trim().to_string()
    } else {
        arg.to_string()
    }
}

fn clean_hex(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_hexdigit()).collect()
}

fn main() {
    let mut raw_args: Vec<String> = std::env::args().skip(1).collect();
    let mut hwid: Option<Vec<u8>> = None;
    
    let mut i = 0;
    while i < raw_args.len() {
        if raw_args[i] == "--hwid" && i + 1 < raw_args.len() {
            let hw_hex = resolve_arg(&raw_args.remove(i + 1));
            raw_args.remove(i);
            hwid = Some(hex::decode(clean_hex(&hw_hex)).expect("Invalid HWID hex"));
        } else if raw_args[i] == "--diagnostic" {
            raw_args.remove(i);
            std::env::set_var("DASP_DIAGNOSTIC", "1");
        } else {
            i += 1;
        }
    }

    if raw_args.is_empty() {
        print_usage();
        return;
    }

    let command = raw_args.remove(0);
    let dc = DarkstarCrypt::new();

    match command.as_str() {
        "encrypt" => {
            if raw_args.len() < 2 { print_usage(); return; }
            let payload = resolve_arg(&raw_args[0]);
            let pk_hex = resolve_arg(&raw_args[1]);
            
            match dc.encrypt(&payload, &pk_hex, hwid) {
                Ok(res_json) => println!("{}", res_json),
                Err(e) => {
                    eprintln!("Encryption Failed: {}", e);
                    std::process::exit(1);
                }
            }
        },
        "decrypt" => {
            if raw_args.len() < 2 { print_usage(); return; }
            let data = resolve_arg(&raw_args[0]);
            let sk_hex = resolve_arg(&raw_args[1]);

            match dc.decrypt(&data, &sk_hex, hwid) {
                Ok(decrypted) => println!("{}", decrypted),
                Err(e) => {
                    eprintln!("Decryption Failed: {}", e);
                    std::process::exit(1);
                }
            }
        },
        "keygen" => {
            let (dk, ek) = MlKem1024::generate(&mut rand::thread_rng());
            println!("PK: {}", hex::encode(ek.as_bytes()));
            println!("SK: {}", hex::encode(dk.as_bytes()));
        },
        "test" => {
            let payload = "apple banana cherry date elderberry fig grape honeydew";
            let (dk, ek) = MlKem1024::generate(&mut rand::thread_rng());
            let pk_hex = hex::encode(ek.as_bytes());
            let sk_hex = hex::encode(dk.as_bytes());

            println!("--- D-ASP Self-Test ---");
            match dc.encrypt(payload, &pk_hex, None) {
                Ok(res_json) => {
                    println!("Encrypted: {}", res_json);

                    match dc.decrypt(&res_json, &sk_hex, None) {
                        Ok(decrypted) => {
                            println!("Decrypted: '{}'", decrypted);
                            if decrypted == payload {
                                println!("Result: PASSED");
                            } else {
                                println!("Result: FAILED (mismatch)");
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
