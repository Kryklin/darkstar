/*
 * D-ASP (ASP Cascade 16)
 * Implementation: Rust (Reference "Gold" Implementation)
 *
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/>
 */

use ml_kem::kem::{Decapsulate, DecapsulationKey, Encapsulate, EncapsulationKey};
use ml_kem::{EncodedSizeUser, MlKem1024Params};
use sha2::{Digest, Sha256, Sha512};
use zeroize::Zeroize;

extern "C" {
    fn host_gettime_us() -> f64;
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Copy)]
pub struct Instant {
    start_us: f64,
}

#[cfg(target_arch = "wasm32")]
impl Instant {
    pub fn now() -> Self {
        let mut us = 0.0;
        unsafe {
            us = host_gettime_us();
        }
        Instant { start_us: us }
    }
    pub fn elapsed(&self) -> core::time::Duration {
        let mut us = 0.0;
        unsafe {
            us = host_gettime_us();
        }
        let diff = us - self.start_us;
        core::time::Duration::from_micros(diff as u64)
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub use std::time::Instant;

#[cfg(target_arch = "x86_64")]
use core::arch::x86_64::*;

/// Deterministic PRNG Implementation
struct DarkstarChaChaPRNG {
    state: [u32; 16],
    block: [u32; 16],
    block_idx: usize,
}

impl DarkstarChaChaPRNG {
    fn new(seed_str: &str) -> Self {
        let mut hasher = Sha512::new();
        hasher.update(seed_str.as_bytes());
        let hash = hasher.finalize();
        let mut state = [0u32; 16];
        state[0] = 0x61707865;
        state[1] = 0x3320646e;
        state[2] = 0x79622d32;
        state[3] = 0x6b206574;
        for i in 0..8 {
            let chunk = &hash[i * 4..(i + 1) * 4];
            state[4 + i] = u32::from_le_bytes(chunk.try_into().unwrap());
        }
        state[12] = 0;
        state[13] = 0;
        state[14] = 0;
        state[15] = 0;

        let block = Self::chacha_block(&state);
        DarkstarChaChaPRNG {
            state,
            block,
            block_idx: 0,
        }
    }

    fn chacha_block(st: &[u32; 16]) -> [u32; 16] {
        let mut x = *st;
        fn rotate(v: u32, n: u32) -> u32 {
            v.rotate_left(n)
        }
        fn quarter_round(x: &mut [u32; 16], a: usize, b: usize, c: usize, d: usize) {
            x[a] = x[a].wrapping_add(x[b]);
            x[d] ^= x[a];
            x[d] = rotate(x[d], 16);
            x[c] = x[c].wrapping_add(x[d]);
            x[b] ^= x[c];
            x[b] = rotate(x[b], 12);
            x[a] = x[a].wrapping_add(x[b]);
            x[d] ^= x[a];
            x[d] = rotate(x[d], 8);
            x[c] = x[c].wrapping_add(x[d]);
            x[b] ^= x[c];
            x[b] = rotate(x[b], 7);
        }
        for _ in 0..10 {
            quarter_round(&mut x, 0, 4, 8, 12);
            quarter_round(&mut x, 1, 5, 9, 13);
            quarter_round(&mut x, 2, 6, 10, 14);
            quarter_round(&mut x, 3, 7, 11, 15);
            quarter_round(&mut x, 0, 5, 10, 15);
            quarter_round(&mut x, 1, 6, 11, 12);
            quarter_round(&mut x, 2, 7, 8, 13);
            quarter_round(&mut x, 3, 4, 9, 14);
        }
        for i in 0..16 {
            x[i] = x[i].wrapping_add(st[i]);
        }
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

#[cfg(target_arch = "x86_64")]
#[inline(always)]
unsafe fn dasp_cascade_32(block: &mut [u8; 32], round_keys: &[u32; 128]) {
    let mut state = _mm256_loadu_si256(block.as_ptr() as *const __m256i);

    macro_rules! dasp_round {
        ($r:expr) => {{
            let rk = _mm256_loadu_si256(round_keys[($r) * 8..].as_ptr() as *const __m256i);
            state = _mm256_add_epi32(state, rk);
            let rc = _mm256_set1_epi32((0x9E3779B9u32).wrapping_add($r) as i32);
            state = _mm256_xor_si256(state, rc);

            let swapped = if (($r) % 3) == 0 {
                _mm256_permutevar8x32_epi32(state, _mm256_set_epi32(3, 2, 1, 0, 7, 6, 5, 4))
            } else if (($r) % 3) == 1 {
                _mm256_permutevar8x32_epi32(state, _mm256_set_epi32(5, 4, 7, 6, 1, 0, 3, 2))
            } else {
                _mm256_permutevar8x32_epi32(state, _mm256_set_epi32(6, 7, 4, 5, 2, 3, 0, 1))
            };

            let a_new = _mm256_add_epi32(state, swapped);
            let mut b_new = _mm256_xor_si256(state, a_new);

            const ROT: i32 = if ($r) % 4 == 0 {
                16
            } else if ($r) % 4 == 1 {
                12
            } else if ($r) % 4 == 2 {
                8
            } else {
                7
            };
            let rotl = _mm256_slli_epi32(b_new, ROT);
            let rotr = _mm256_srli_epi32(b_new, 32 - ROT);
            b_new = _mm256_or_si256(rotl, rotr);

            if (($r) % 3) == 0 {
                state = _mm256_blend_epi32(a_new, b_new, 0xF0);
            } else if (($r) % 3) == 1 {
                state = _mm256_blend_epi32(a_new, b_new, 0xCC);
            } else {
                state = _mm256_blend_epi32(a_new, b_new, 0xAA);
            }
        }};
    }

    dasp_round!(0);
    dasp_round!(1);
    dasp_round!(2);
    dasp_round!(3);
    dasp_round!(4);
    dasp_round!(5);
    dasp_round!(6);
    dasp_round!(7);
    dasp_round!(8);
    dasp_round!(9);
    dasp_round!(10);
    dasp_round!(11);
    dasp_round!(12);
    dasp_round!(13);
    dasp_round!(14);
    dasp_round!(15);

    _mm256_storeu_si256(block.as_mut_ptr() as *mut __m256i, state);
}

// Fallback for non-x86 architectures
#[cfg(not(target_arch = "x86_64"))]
fn dasp_cascade_32(block: &mut [u8; 32], round_keys: &[u32; 128]) {
    let mut state = [0u32; 8];
    for i in 0..8 {
        let chunk = &block[i * 4..(i + 1) * 4];
        state[i] = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
    }

    let dist_arr = [4, 2, 1];
    let rot_arr = [16, 12, 8, 7];

    for r in 0..16 {
        let rk = &round_keys[r * 8..(r + 1) * 8];
        for j in 0..8 {
            state[j] = state[j].wrapping_add(rk[j]);
        }
        let rc = 0x9E3779B9u32.wrapping_add(r as u32);
        for j in 0..8 {
            state[j] ^= rc;
        }

        let dist = dist_arr[r % 3];
        let rot = rot_arr[r % 4];

        let mut i = 0;
        while i < 8 {
            for j in 0..dist {
                let a = i + j;
                let b = i + j + dist;
                state[a] = state[a].wrapping_add(state[b]);
                state[b] ^= state[a];
                state[b] = (state[b] << rot) | (state[b] >> (32 - rot));
            }
            i += dist * 2;
        }
    }

    for i in 0..8 {
        let bytes = state[i].to_le_bytes();
        block[i * 4..(i + 1) * 4].copy_from_slice(&bytes);
    }
}

#[allow(dead_code)]
fn generate_checksum(numbers: &[usize]) -> usize {
    if numbers.is_empty() {
        return 0;
    }
    let sum: usize = numbers.iter().sum();
    sum % 997
}

fn clean_hex(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_hexdigit()).collect()
}

pub struct DarkstarCrypt {}

impl Default for DarkstarCrypt {
    fn default() -> Self {
        Self::new()
    }
}

impl DarkstarCrypt {
    pub fn new() -> Self {
        DarkstarCrypt {}
    }

    pub fn encrypt(
        &self,
        payload_str: &str,
        pk_hex: &str,
        hwid: Option<Vec<u8>>,
        telemetry: bool,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let total_start = Instant::now();

        let pk_bytes: [u8; 1568] = hex::decode(clean_hex(pk_hex))?
            .try_into()
            .map_err(|_| format!("Invalid public key length (Arg length: {})", pk_hex.len()))?;

        let kem_start = Instant::now();
        let ek = EncapsulationKey::<MlKem1024Params>::from_bytes(&pk_bytes.into());
        let (ct, mut ss) = ek
            .encapsulate(&mut rand::thread_rng())
            .map_err(|e| format!("KEM failed: {:?}", e))?;
        let ct_hex = hex::encode(&ct[..]);
        let ss_bytes = &ss[..];
        let kem_duration = kem_start.elapsed();

        let kdf_start = Instant::now();
        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<Sha256>;
        let default_salt = [0u8; 32];
        let salt = match &hwid {
            Some(h) => h.as_slice(),
            None => &default_salt,
        };
        let mut prk_mac = <HmacSha256 as hmac::Mac>::new_from_slice(salt)
            .map_err(|e| format!("HMAC init error: {:?}", e))?;
        prk_mac.update(ss_bytes);
        let mut prk = prk_mac.finalize().into_bytes();

        let mut expand_mac = <HmacSha256 as hmac::Mac>::new_from_slice(&prk)
            .map_err(|e| format!("HMAC init error: {:?}", e))?;
        expand_mac.update(b"dasp-identity-v3\x01");
        let mut blended_ss = expand_mac.finalize().into_bytes();
        let blended_ss_hex = hex::encode(blended_ss);

        let mut cipher_hasher = Sha256::new();
        cipher_hasher.update(b"cipher");
        cipher_hasher.update(blended_ss);
        let mut cipher_key = cipher_hasher.finalize();

        let mut hmac_hasher = Sha256::new();
        hmac_hasher.update(b"hmac");
        hmac_hasher.update(blended_ss);
        let mut hmac_key = hmac_hasher.finalize();

        let mut active_password_str = hex::encode(cipher_key);
        ss.zeroize();
        let kdf_duration = kdf_start.elapsed();

        let mut word_key: Vec<u8> = {
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(active_password_str.as_bytes())
                .map_err(|e| format!("HMAC init error: {:?}", e))?;
            mac.update(b"dasp-word-0");
            mac.finalize().into_bytes().to_vec()
        };
        let word_key_hex = hex::encode(&word_key);

        let mut chain_hasher = Sha256::new();
        chain_hasher.update(format!("dasp-chain-{}", active_password_str).as_bytes());
        let mut chain_state = chain_hasher.finalize().to_vec();

        let mut rng = DarkstarChaChaPRNG::new(&word_key_hex);
        let mut round_keys = [0u32; 128];
        for key in round_keys.iter_mut() {
            *key = rng.next();
        }

        let mut payload_bytes = payload_str.as_bytes().to_vec();
        let cascade_start = Instant::now();

        // CTR Mode Encryption
        let mut nonce = chain_state.clone();
        for chunk in payload_bytes.chunks_mut(32) {
            let mut block = [0u8; 32];
            block.copy_from_slice(&nonce);

            #[cfg(target_arch = "x86_64")]
            unsafe {
                dasp_cascade_32(&mut block, &round_keys);
            }
            #[cfg(not(target_arch = "x86_64"))]
            dasp_cascade_32(&mut block, &round_keys);

            for (i, b) in chunk.iter_mut().enumerate() {
                *b ^= block[i];
            }

            // Increment nonce
            for b in nonce.iter_mut() {
                *b = b.wrapping_add(1);
                if *b != 0 {
                    break;
                }
            }
        }
        let cascade_duration = cascade_start.elapsed();

        let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&hmac_key)
            .map_err(|e| format!("HMAC error: {:?}", e))?;
        mac.update(&ct[..]);
        mac.update(&payload_bytes);
        let mac_tag = hex::encode(mac.finalize().into_bytes());

        prk.zeroize();
        blended_ss.zeroize();
        cipher_key.zeroize();
        hmac_key.zeroize();
        word_key.zeroize();
        chain_state.zeroize();
        active_password_str.zeroize();
        round_keys.zeroize();

        if std::env::var("DASP_DIAGNOSTIC").is_ok() {
            eprintln!(
                "{}",
                serde_json::json!({
                    "diagnostics": {
                        "stage1_blended_ss": blended_ss_hex,
                        "stage2_word_key": word_key_hex,
                        "stage4_mac": mac_tag
                    }
                })
            );
        }
        let total_duration = total_start.elapsed();

        prk.zeroize();
        blended_ss.zeroize();
        cipher_key.zeroize();
        hmac_key.zeroize();
        word_key.zeroize();
        chain_state.zeroize();
        active_password_str.zeroize();
        round_keys.zeroize();

        let mut res_obj = serde_json::json!({
            "data": hex::encode(&payload_bytes),
            "ct": ct_hex,
            "mac": mac_tag,
        });

        if telemetry {
            res_obj.as_object_mut().unwrap().insert(
                "timings".to_string(),
                serde_json::json!({
                    "kem_us": kem_duration.as_micros(),
                    "kdf_us": kdf_duration.as_micros(),
                    "cascade_us": cascade_duration.as_micros(),
                    "total_us": total_duration.as_micros()
                }),
            );
        }

        Ok(res_obj.to_string())
    }

    pub fn decrypt(
        &self,
        encrypted_data_raw: &str,
        sk_hex: &str,
        hwid: Option<Vec<u8>>,
        telemetry: bool,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let total_start = Instant::now();
        let value: serde_json::Value = serde_json::from_str(encrypted_data_raw)?;

        let ct_hex = value["ct"].as_str().ok_or("Missing CT")?;
        let encrypted_content = value["data"].as_str().ok_or("Missing data")?;
        let mac_tag_hex = value["mac"].as_str().ok_or("Missing MAC")?;

        let sk_bytes: [u8; 3168] = hex::decode(clean_hex(sk_hex))?
            .try_into()
            .map_err(|_| format!("Invalid secret key length (Arg length: {})", sk_hex.len()))?;
        let ct_bytes: [u8; 1568] = hex::decode(clean_hex(ct_hex))?
            .try_into()
            .map_err(|_| format!("Invalid ciphertext length (Arg length: {})", ct_hex.len()))?;

        let kem_start = Instant::now();
        let dk = DecapsulationKey::<MlKem1024Params>::from_bytes(&sk_bytes.into());
        let mut ss = dk
            .decapsulate(&ct_bytes.into())
            .map_err(|e| format!("KEM decapsulation failed: {:?}", e))?;
        let ss_bytes = &ss[..];
        let kem_duration = kem_start.elapsed();

        let kdf_start = Instant::now();
        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<Sha256>;
        let default_salt = [0u8; 32];
        let salt = match &hwid {
            Some(h) => h.as_slice(),
            None => &default_salt,
        };
        let mut prk_mac = <HmacSha256 as hmac::Mac>::new_from_slice(salt)
            .map_err(|e| format!("HMAC init error: {:?}", e))?;
        prk_mac.update(ss_bytes);
        let mut prk = prk_mac.finalize().into_bytes();

        let mut expand_mac = <HmacSha256 as hmac::Mac>::new_from_slice(&prk)
            .map_err(|e| format!("HMAC init error: {:?}", e))?;
        expand_mac.update(b"dasp-identity-v3\x01");
        let mut blended_ss = expand_mac.finalize().into_bytes();
        let blended_ss_hex = hex::encode(blended_ss);

        let mut cipher_hasher = Sha256::new();
        cipher_hasher.update(b"cipher");
        cipher_hasher.update(blended_ss);
        let mut cipher_key = cipher_hasher.finalize();

        let mut hmac_hasher = Sha256::new();
        hmac_hasher.update(b"hmac");
        hmac_hasher.update(blended_ss);
        let mut hmac_key = hmac_hasher.finalize();

        let mut active_password_str = hex::encode(cipher_key);
        ss.zeroize();
        let kdf_duration = kdf_start.elapsed();

        let mut word_key: Vec<u8> = {
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(active_password_str.as_bytes())
                .map_err(|e| format!("HMAC error: {:?}", e))?;
            mac.update(b"dasp-word-0");
            mac.finalize().into_bytes().to_vec()
        };
        let word_key_hex = hex::encode(&word_key);

        let mut payload_bytes = hex::decode(encrypted_content)?;
        let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&hmac_key)
            .map_err(|e| format!("HMAC error: {:?}", e))?;
        mac.update(&ct_bytes);
        mac.update(&payload_bytes);
        let mac_tag_actual = hex::encode(mac.clone().finalize().into_bytes());

        if std::env::var("DASP_DIAGNOSTIC").is_ok() {
            eprintln!(
                "{}",
                serde_json::json!({
                    "diagnostics": {
                        "stage1_blended_ss": blended_ss_hex,
                        "stage2_word_key": word_key_hex,
                        "stage4_mac": mac_tag_actual
                    }
                })
            );
        }

        mac.verify_slice(&hex::decode(mac_tag_hex)?)
            .map_err(|_| "Integrity Check Failed")?;

        let mut chain_hasher = Sha256::new();
        chain_hasher.update(format!("dasp-chain-{}", active_password_str).as_bytes());
        let mut chain_state = chain_hasher.finalize().to_vec();

        let mut rng = DarkstarChaChaPRNG::new(&word_key_hex);
        let mut round_keys = [0u32; 128];
        for key in round_keys.iter_mut() {
            *key = rng.next();
        }

        let cascade_start = Instant::now();
        let mut nonce = chain_state.clone();
        for chunk in payload_bytes.chunks_mut(32) {
            let mut block = [0u8; 32];
            block.copy_from_slice(&nonce);

            #[cfg(target_arch = "x86_64")]
            unsafe {
                dasp_cascade_32(&mut block, &round_keys);
            }
            #[cfg(not(target_arch = "x86_64"))]
            dasp_cascade_32(&mut block, &round_keys);

            for (i, b) in chunk.iter_mut().enumerate() {
                *b ^= block[i];
            }

            // Increment nonce
            for b in nonce.iter_mut() {
                *b = b.wrapping_add(1);
                if *b != 0 {
                    break;
                }
            }
        }
        let cascade_duration = cascade_start.elapsed();

        let result = String::from_utf8(payload_bytes)?;
        let total_duration = total_start.elapsed();

        prk.zeroize();
        blended_ss.zeroize();
        cipher_key.zeroize();
        hmac_key.zeroize();
        word_key.zeroize();
        chain_state.zeroize();
        active_password_str.zeroize();
        round_keys.zeroize();

        if telemetry {
            let res_obj = serde_json::json!({
                "data": result,
                "timings": {
                    "kem_us": kem_duration.as_micros(),
                    "kdf_us": kdf_duration.as_micros(),
                    "cascade_us": cascade_duration.as_micros(),
                    "total_us": total_duration.as_micros()
                }
            });
            Ok(res_obj.to_string())
        } else {
            Ok(result)
        }
    }
}
