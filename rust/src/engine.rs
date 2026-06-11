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
    #[allow(dead_code)]
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
        let us = unsafe { host_gettime_us() };
        Instant { start_us: us }
    }
    pub fn elapsed(&self) -> core::time::Duration {
        let us = unsafe { host_gettime_us() };
        let diff = us - self.start_us;
        core::time::Duration::from_micros(diff as u64)
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub use std::time::Instant;


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
        for i in 0..16 {
            let chunk = &hash[i * 4..(i + 1) * 4];
            state[i] = u32::from_le_bytes(chunk.try_into().unwrap());
        }

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
        macro_rules! double_round {
            () => {
                quarter_round(&mut x, 0, 4, 8, 12);
                quarter_round(&mut x, 1, 5, 9, 13);
                quarter_round(&mut x, 2, 6, 10, 14);
                quarter_round(&mut x, 3, 7, 11, 15);
                quarter_round(&mut x, 0, 5, 10, 15);
                quarter_round(&mut x, 1, 6, 11, 12);
                quarter_round(&mut x, 2, 7, 8, 13);
                quarter_round(&mut x, 3, 4, 9, 14);
            };
        }
        double_round!(); double_round!(); double_round!(); double_round!(); double_round!();
        double_round!(); double_round!(); double_round!(); double_round!(); double_round!();
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

#[inline(always)]
fn dasp_cascade_64(block: &mut [u8; 64], round_keys: &[u64; 128]) {
    let mut state = [0u64; 8];
    for i in 0..8 {
        let chunk = &block[i * 8..(i + 1) * 8];
        state[i] = u64::from_le_bytes([
            chunk[0], chunk[1], chunk[2], chunk[3],
            chunk[4], chunk[5], chunk[6], chunk[7]
        ]);
    }

    macro_rules! unroll_rounds {
        ($($r:expr, $dist:expr, $rot:expr);* $(;)?) => {
            $(
                let rk = &round_keys[$r * 8..($r + 1) * 8];
                state[0] = state[0].wrapping_add(rk[0]);
                state[1] = state[1].wrapping_add(rk[1]);
                state[2] = state[2].wrapping_add(rk[2]);
                state[3] = state[3].wrapping_add(rk[3]);
                state[4] = state[4].wrapping_add(rk[4]);
                state[5] = state[5].wrapping_add(rk[5]);
                state[6] = state[6].wrapping_add(rk[6]);
                state[7] = state[7].wrapping_add(rk[7]);
                
                let rc = 0x9E3779B97F4A7C15u64.wrapping_add($r);
                state[0] ^= rc; state[1] ^= rc; state[2] ^= rc; state[3] ^= rc;
                state[4] ^= rc; state[5] ^= rc; state[6] ^= rc; state[7] ^= rc;

                // Fully manual unroll of the network mixing layer
                if $dist == 4 {
                    state[0] = state[0].wrapping_add(state[4]); state[4] ^= state[0]; state[4] = state[4].rotate_left($rot as u32);
                    state[1] = state[1].wrapping_add(state[5]); state[5] ^= state[1]; state[5] = state[5].rotate_left($rot as u32);
                    state[2] = state[2].wrapping_add(state[6]); state[6] ^= state[2]; state[6] = state[6].rotate_left($rot as u32);
                    state[3] = state[3].wrapping_add(state[7]); state[7] ^= state[3]; state[7] = state[7].rotate_left($rot as u32);
                } else if $dist == 2 {
                    state[0] = state[0].wrapping_add(state[2]); state[2] ^= state[0]; state[2] = state[2].rotate_left($rot as u32);
                    state[1] = state[1].wrapping_add(state[3]); state[3] ^= state[1]; state[3] = state[3].rotate_left($rot as u32);
                    state[4] = state[4].wrapping_add(state[6]); state[6] ^= state[4]; state[6] = state[6].rotate_left($rot as u32);
                    state[5] = state[5].wrapping_add(state[7]); state[7] ^= state[5]; state[7] = state[7].rotate_left($rot as u32);
                } else {
                    state[0] = state[0].wrapping_add(state[1]); state[1] ^= state[0]; state[1] = state[1].rotate_left($rot as u32);
                    state[2] = state[2].wrapping_add(state[3]); state[3] ^= state[2]; state[3] = state[3].rotate_left($rot as u32);
                    state[4] = state[4].wrapping_add(state[5]); state[5] ^= state[4]; state[5] = state[5].rotate_left($rot as u32);
                    state[6] = state[6].wrapping_add(state[7]); state[7] ^= state[6]; state[7] = state[7].rotate_left($rot as u32);
                }
            )*
        }
    }

    unroll_rounds!(
        0, 4, 32;
        1, 2, 24;
        2, 1, 16;
        3, 4, 14;
        4, 2, 32;
        5, 1, 24;
        6, 4, 16;
        7, 2, 14;
        8, 1, 32;
        9, 4, 24;
        10, 2, 16;
        11, 1, 14;
        12, 4, 32;
        13, 2, 24;
        14, 1, 16;
        15, 4, 14
    );

    for i in 0..8 {
        let bytes = state[i].to_le_bytes();
        block[i * 8..(i + 1) * 8].copy_from_slice(&bytes);
    }
}

static CHACHA_CONSTANTS: [u32; 4] = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

pub fn verify_constants() {
    let sum: u32 = CHACHA_CONSTANTS.iter().fold(0, |acc, &x| acc.wrapping_add(x));
    assert_eq!(sum, 2031316857, "FATAL: Rowhammer/Corruption detected in static arrays.");
}

#[allow(dead_code)]
fn generate_checksum(numbers: &[usize]) -> usize {
    if numbers.is_empty() {
        return 0;
    }
    let sum: usize = numbers.iter().sum();
    sum % 997
}

fn fast_hex_decode(s: &str) -> Result<Vec<u8>, hex::FromHexError> {
    let mut bytes = Vec::with_capacity(s.len() / 2);
    let mut current_byte = 0u8;
    let mut has_nibble = false;

    for &b in s.as_bytes() {
        let val = match b {
            b'0'..=b'9' => b - b'0',
            b'a'..=b'f' => b - b'a' + 10,
            b'A'..=b'F' => b - b'A' + 10,
            _ => continue, // Ignore non-hex chars
        };

        if has_nibble {
            bytes.push((current_byte << 4) | val);
            has_nibble = false;
        } else {
            current_byte = val;
            has_nibble = true;
        }
    }
    Ok(bytes)
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

    fn check_dpa_pattern(sig: u64) -> bool {
        use std::sync::atomic::{AtomicU64, Ordering};
        
        static DPA_HISTORY: [AtomicU64; 10] = [
            AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0),
            AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0)
        ];
        static DPA_IDX: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

        let idx = DPA_IDX.fetch_add(1, Ordering::SeqCst) % 10;
        DPA_HISTORY[idx].store(sig, Ordering::SeqCst);

        let mut matches = 0;
        let mut consecutive = 0;
        let mut last_was_match = false;

        for hist_atom in &DPA_HISTORY {
            let hist_val = hist_atom.load(Ordering::SeqCst);
            if hist_val == sig && sig != 0 {
                matches += 1;
                if last_was_match || consecutive == 0 {
                    consecutive += 1;
                }
                last_was_match = true;
            } else {
                last_was_match = false;
                consecutive = 0;
            }
        }

        // Drop until varies: 5 consecutive OR 5 total in the window
        consecutive >= 5 || matches >= 5
    }

    /// Encrypts a string payload using D-ASP and ML-KEM-1024.
    ///
    /// # Arguments
    /// * `payload_str` - The plaintext string to encrypt.
    /// * `pk_hex` - The ML-KEM-1024 public key in hex format.
    /// * `hwid` - Optional hardware ID binding.
    /// * `telemetry` - If true, returns detailed timing metrics.
    pub fn encrypt(
        &self,
        payload_str: &str,
        pk_hex: &str,
        hwid: Option<Vec<u8>>,
        telemetry: bool,
    ) -> Result<String, Box<dyn std::error::Error>> {
        crate::engine::verify_constants();
        let total_start = Instant::now();

        let pk_bytes: [u8; 1568] = fast_hex_decode(pk_hex)?
            .try_into()
            .map_err(|_| format!("Invalid public key length (Arg length: {})", pk_hex.len()))?;

        // ---------------------------------------------------------
        // PHASE 1: KEM Encapsulation & Shared Secret Generation
        // ---------------------------------------------------------
        let kem_start = Instant::now();
        let ek = EncapsulationKey::<MlKem1024Params>::from_bytes(&pk_bytes.into());
        let (ct, mut ss) = ek
            .encapsulate(&mut rand::rngs::OsRng)
            .map_err(|e| format!("KEM Encapsulation failed: {:?}", e))?;
        let ct_hex = hex::encode(&ct[..]);
        let ss_bytes = &ss[..];
        let kem_duration = kem_start.elapsed();

        // ---------------------------------------------------------
        // PHASE 2: Hardware ID Binding (HKDF-like Expand)
        // ---------------------------------------------------------
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

        // ---------------------------------------------------------
        // PHASE 3: Subkey Derivation (Cipher & HMAC Keys)
        // ---------------------------------------------------------
        let mut cipher_hasher = Sha256::new();
        cipher_hasher.update(b"cipher");
        cipher_hasher.update(blended_ss);
        let mut cipher_key = cipher_hasher.finalize();

        let mut hmac_hasher = Sha256::new();
        hmac_hasher.update(b"hmac");
        hmac_hasher.update(blended_ss);
        let mut hmac_key = hmac_hasher.finalize();

        let mut active_password_bytes = [0u8; 64];
        hex::encode_to_slice(cipher_key, &mut active_password_bytes).unwrap();
        ss.zeroize();
        let kdf_duration = kdf_start.elapsed();

        let mut word_key: Vec<u8> = {
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&active_password_bytes)
                .map_err(|e| format!("HMAC init error: {:?}", e))?;
            mac.update(b"dasp-word-0");
            mac.finalize().into_bytes().to_vec()
        };
        let mut word_key_hex = [0u8; 64];
        hex::encode_to_slice(&word_key, &mut word_key_hex).unwrap();
        let word_key_str = std::str::from_utf8(&word_key_hex).unwrap();

        let mut chain_hasher = Sha512::new();
        chain_hasher.update(b"dasp-chain-");
        chain_hasher.update(active_password_bytes);
        let mut chain_state = chain_hasher.finalize().to_vec();

        let mut rng = DarkstarChaChaPRNG::new(word_key_str);
        let mut round_keys = [0u64; 128];
        for key in round_keys.iter_mut() {
            let lo = rng.next() as u64;
            let hi = rng.next() as u64;
            *key = (hi << 32) | lo;
        }

        // --- DPA Signature Generation ---
        let mut sig_hasher = std::collections::hash_map::DefaultHasher::new();
        std::hash::Hash::hash_slice(&blended_ss, &mut sig_hasher);
        let prefix_len = std::cmp::min(payload_str.len(), 32);
        std::hash::Hash::hash_slice(&payload_str.as_bytes()[..prefix_len], &mut sig_hasher);
        let transaction_sig = std::hash::Hasher::finish(&sig_hasher);
        
        let dpa_triggered = Self::check_dpa_pattern(transaction_sig);

        // ---------------------------------------------------------
        // PHASE 4: Block Encryption (D-ASP Cascade 16)
        // ---------------------------------------------------------
        let mut payload_bytes = payload_str.as_bytes().to_vec();
        let cascade_start = Instant::now();

        // CTR Mode Encryption
        let mut nonce = chain_state.clone(); // chain_state is 64 bytes from Sha512
        for chunk in payload_bytes.chunks_mut(64) {
            let mut block = [0u8; 64];
            block.copy_from_slice(&nonce);

            // DPA Lockout Logic - Zeroize state if duplicate pattern matches transaction sig
            if dpa_triggered && chunk.len() > 16 && chunk[0] == 0x00 && chunk[1] == 0x00 {
                block.zeroize();
                return Err("DPA_LOCKOUT: Hardware Pattern Match Triggered. System Halting.".into());
            }

            dasp_cascade_64(&mut block, &round_keys);

            if chunk.len() == 64 {
                let chunk_u64 = unsafe { std::slice::from_raw_parts_mut(chunk.as_mut_ptr() as *mut u64, 8) };
                let block_u64 = unsafe { std::slice::from_raw_parts(block.as_ptr() as *const u64, 8) };
                chunk_u64[0] ^= block_u64[0];
                chunk_u64[1] ^= block_u64[1];
                chunk_u64[2] ^= block_u64[2];
                chunk_u64[3] ^= block_u64[3];
                chunk_u64[4] ^= block_u64[4];
                chunk_u64[5] ^= block_u64[5];
                chunk_u64[6] ^= block_u64[6];
                chunk_u64[7] ^= block_u64[7];
            } else {
                for (i, byte) in chunk.iter_mut().enumerate() {
                    *byte ^= block[i];
                }
            }

            // Increment 64-byte nonce (CTR mode)
            for byte in nonce.iter_mut().rev() {
                let (val, overflow) = byte.overflowing_add(1);
                *byte = val;
                if !overflow {
                    break;
                }
            }
        }
        let cascade_duration = cascade_start.elapsed();

        let current_ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&hmac_key)
            .map_err(|e| format!("HMAC error: {:?}", e))?;
        mac.update(&ct[..]);
        mac.update(&payload_bytes);
        mac.update(&current_ts.to_be_bytes());
        let mac_tag = hex::encode(mac.finalize().into_bytes());

        prk.zeroize();
        blended_ss.zeroize();
        cipher_key.zeroize();
        hmac_key.zeroize();
        word_key.zeroize();
        chain_state.zeroize();
        active_password_bytes.zeroize();
        round_keys.zeroize();

        let total_duration = total_start.elapsed();

        prk.zeroize();
        blended_ss.zeroize();
        cipher_key.zeroize();
        hmac_key.zeroize();
        word_key.zeroize();
        chain_state.zeroize();
        active_password_bytes.zeroize();
        round_keys.zeroize();

        if dpa_triggered {
            return Err("DPA_LOCKOUT".into());
        }

        let mut res_obj = serde_json::json!({
            "data": hex::encode(&payload_bytes),
            "ct": ct_hex,
            "mac": mac_tag,
            "ts": current_ts,
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

    /// Decrypts a D-ASP cipher payload using ML-KEM-1024.
    ///
    /// # Arguments
    /// * `encrypted_data_raw` - The JSON string containing CT, Data, and MAC.
    /// * `sk_hex` - The ML-KEM-1024 secret key in hex format.
    /// * `hwid` - Optional hardware ID binding.
    /// * `telemetry` - If true, returns detailed timing metrics.
    pub fn decrypt(
        &self,
        encrypted_data_raw: &str,
        sk_hex: &str,
        hwid: Option<Vec<u8>>,
        telemetry: bool,
        ttl_secs: Option<u64>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        crate::engine::verify_constants();
        #[derive(serde::Deserialize)]
        struct EncPayload<'a> {
            data: &'a str,
            ct: &'a str,
            mac: &'a str,
            ts: Option<u64>,
        }

        let total_start = Instant::now();
        let payload: EncPayload = serde_json::from_str(encrypted_data_raw)?;

        let ct_hex = payload.ct;
        let encrypted_content = payload.data;
        let mac_tag_hex = payload.mac;

        let sk_bytes: [u8; 3168] = fast_hex_decode(sk_hex)?
            .try_into()
            .map_err(|_| format!("Invalid secret key length (Arg length: {})", sk_hex.len()))?;
        let ct_bytes: [u8; 1568] = fast_hex_decode(ct_hex)?
            .try_into()
            .map_err(|_| format!("Invalid ciphertext length (Arg length: {})", ct_hex.len()))?;

        // ---------------------------------------------------------
        // PHASE 1: KEM Decapsulation & Shared Secret Recovery
        // ---------------------------------------------------------
        let kem_start = Instant::now();
        let dk = DecapsulationKey::<MlKem1024Params>::from_bytes(&sk_bytes.into());
        let mut ss = dk
            .decapsulate(&ct_bytes.into())
            .map_err(|e| format!("KEM decapsulation failed: {:?}", e))?;
        let ss_bytes = &ss[..];
        let kem_duration = kem_start.elapsed();

        // ---------------------------------------------------------
        // PHASE 2: Hardware ID Binding Verification
        // ---------------------------------------------------------
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

        // ---------------------------------------------------------
        // PHASE 3: Subkey Derivation & MAC Verification
        // ---------------------------------------------------------
        let mut cipher_hasher = Sha256::new();
        cipher_hasher.update(b"cipher");
        cipher_hasher.update(blended_ss);
        let mut cipher_key = cipher_hasher.finalize();

        let mut hmac_hasher = Sha256::new();
        hmac_hasher.update(b"hmac");
        hmac_hasher.update(blended_ss);
        let mut hmac_key = hmac_hasher.finalize();

        let mut active_password_bytes = [0u8; 64];
        hex::encode_to_slice(cipher_key, &mut active_password_bytes).unwrap();
        ss.zeroize();
        let kdf_duration = kdf_start.elapsed();

        let mut word_key: Vec<u8> = {
            let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&active_password_bytes)
                .map_err(|e| format!("HMAC error: {:?}", e))?;
            mac.update(b"dasp-word-0");
            mac.finalize().into_bytes().to_vec()
        };
        let mut word_key_hex = [0u8; 64];
        hex::encode_to_slice(&word_key, &mut word_key_hex).unwrap();
        let word_key_str = std::str::from_utf8(&word_key_hex).unwrap();

        let mut payload_bytes = fast_hex_decode(encrypted_content)?;
        let mut mac = <HmacSha256 as hmac::Mac>::new_from_slice(&hmac_key)
            .map_err(|e| format!("HMAC error: {:?}", e))?;
        mac.update(&ct_bytes);
        mac.update(&payload_bytes);
        if let Some(t) = payload.ts {
            mac.update(&t.to_be_bytes());
        }
        let actual_mac = mac.finalize().into_bytes();
        let expected_mac = fast_hex_decode(mac_tag_hex)?;
        
        let mut diff_verify = 0u8;
        for i in 0..32 {
            diff_verify |= actual_mac[i] ^ expected_mac[i];
        }
        
        let valid_2 = unsafe { std::ptr::read_volatile(&diff_verify) } == 0;
        
        if !valid_2 {
            return Err("Integrity Check Failed".into());
        }

        #[cfg(target_arch = "x86_64")]
        unsafe { core::arch::x86_64::_mm_lfence() };
        #[cfg(target_arch = "aarch64")]
        unsafe { core::arch::aarch64::isb(core::arch::aarch64::SY) };
        std::sync::atomic::compiler_fence(std::sync::atomic::Ordering::SeqCst);

        if let Some(t_secs) = ttl_secs {
            if let Some(pt) = payload.ts {
                let current_ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
                if current_ts > pt + t_secs {
                    return Err("Payload Expired (Replay Protection)".into());
                }
            } else {
                return Err("Payload missing timestamp (Replay Protection enforced)".into());
            }
        }

        let mut chain_hasher = Sha512::new();
        chain_hasher.update(b"dasp-chain-");
        chain_hasher.update(active_password_bytes);
        let mut chain_state = chain_hasher.finalize().to_vec();

        let mut rng = DarkstarChaChaPRNG::new(word_key_str);
        let mut round_keys = [0u64; 128];
        for key in round_keys.iter_mut() {
            let lo = rng.next() as u64;
            let hi = rng.next() as u64;
            *key = (hi << 32) | lo;
        }

        // ---------------------------------------------------------
        // PHASE 4: Block Decryption (D-ASP Cascade 16)
        // ---------------------------------------------------------
        let cascade_start = Instant::now();
        let mut nonce = chain_state.clone();
        for chunk in payload_bytes.chunks_mut(64) {
            let mut block = [0u8; 64];
            block.copy_from_slice(&nonce);

            dasp_cascade_64(&mut block, &round_keys);

            if chunk.len() == 64 {
                let chunk_u64 = unsafe { std::slice::from_raw_parts_mut(chunk.as_mut_ptr() as *mut u64, 8) };
                let block_u64 = unsafe { std::slice::from_raw_parts(block.as_ptr() as *const u64, 8) };
                chunk_u64[0] ^= block_u64[0];
                chunk_u64[1] ^= block_u64[1];
                chunk_u64[2] ^= block_u64[2];
                chunk_u64[3] ^= block_u64[3];
                chunk_u64[4] ^= block_u64[4];
                chunk_u64[5] ^= block_u64[5];
                chunk_u64[6] ^= block_u64[6];
                chunk_u64[7] ^= block_u64[7];
            } else {
                for (i, b) in chunk.iter_mut().enumerate() {
                    *b ^= block[i];
                }
            }

            // Increment nonce
            for b in nonce.iter_mut().rev() {
                let (val, overflow) = b.overflowing_add(1);
                *b = val;
                if !overflow {
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
        active_password_bytes.zeroize();
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
