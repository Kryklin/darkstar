use ml_kem::{MlKem1024, MlKem1024Params, KemCore, EncodedSizeUser};
use ml_kem::kem::{EncapsulationKey, DecapsulationKey, Encapsulate, Decapsulate};
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use std::slice;

type HmacSha256 = Hmac<Sha256>;

#[no_mangle]
pub extern "C" fn crypto_kem_keypair(pk: *mut u8, sk: *mut u8) -> i32 {
    let (dk, ek) = MlKem1024::generate(&mut rand::thread_rng());
    unsafe {
        std::ptr::copy_nonoverlapping(ek.as_bytes().as_ptr(), pk, ek.as_bytes().len());
        std::ptr::copy_nonoverlapping(dk.as_bytes().as_ptr(), sk, dk.as_bytes().len());
    }
    0
}

#[no_mangle]
pub extern "C" fn crypto_kem_enc(ct_out: *mut u8, ss_out: *mut u8, pk: *const u8) -> i32 {
    let pk_slice = unsafe { slice::from_raw_parts(pk, 1568) };
    let ek = EncapsulationKey::<MlKem1024Params>::from_bytes(pk_slice.try_into().unwrap());
    let (ct, ss) = ek.encapsulate(&mut rand::thread_rng()).unwrap();
    unsafe {
        std::ptr::copy_nonoverlapping(ct.as_ptr(), ct_out, ct.len());
        std::ptr::copy_nonoverlapping(ss.as_ptr(), ss_out, ss.len());
    }
    0
}

#[no_mangle]
pub extern "C" fn crypto_kem_dec(ss_out: *mut u8, ct: *const u8, sk: *const u8) -> i32 {
    let sk_slice = unsafe { slice::from_raw_parts(sk, 3168) };
    let ct_slice = unsafe { slice::from_raw_parts(ct, 1568) };
    let dk = DecapsulationKey::<MlKem1024Params>::from_bytes(sk_slice.try_into().unwrap());
    let ss = dk.decapsulate(ct_slice.try_into().unwrap()).unwrap();
    unsafe {
        std::ptr::copy_nonoverlapping(ss.as_ptr(), ss_out, ss.len());
    }
    0
}

#[no_mangle]
pub extern "C" fn crypto_sha256(data: *const u8, len: usize, out: *mut u8) {
    let data_slice = unsafe { slice::from_raw_parts(data, len) };
    let mut hasher = Sha256::new();
    hasher.update(data_slice);
    let result = hasher.finalize();
    unsafe {
        std::ptr::copy_nonoverlapping(result.as_ptr(), out, result.len());
    }
}

#[no_mangle]
pub extern "C" fn crypto_hmac_sha256(key: *const u8, key_len: usize, data: *const u8, data_len: usize, out: *mut u8) {
    let key_slice = unsafe { slice::from_raw_parts(key, key_len) };
    let data_slice = unsafe { slice::from_raw_parts(data, data_len) };
    let mut mac = HmacSha256::new_from_slice(key_slice).unwrap();
    mac.update(data_slice);
    let result = mac.finalize().into_bytes();
    unsafe {
        std::ptr::copy_nonoverlapping(result.as_ptr(), out, result.len());
    }
}
