use crate::engine::DarkstarCrypt;
use getrandom::{register_custom_getrandom, Error};

extern "C" {
    fn host_getrandom(ptr: *mut u8, len: usize);
}

fn custom_getrandom(buf: &mut [u8]) -> Result<(), Error> {
    unsafe {
        host_getrandom(buf.as_mut_ptr(), buf.len());
    }
    Ok(())
}

register_custom_getrandom!(custom_getrandom);

#[no_mangle]
pub extern "C" fn wasm_alloc(size: usize) -> *mut u8 {
    let mut buf = vec![0u8; size];
    buf.shrink_to_fit();
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn wasm_dealloc(ptr: *mut u8, size: usize) {
    unsafe {
        let _ = Vec::from_raw_parts(ptr, size, size);
    }
}

#[no_mangle]
pub extern "C" fn wasm_encrypt(
    payload_ptr: *const u8,
    payload_len: usize,
    pk_ptr: *const u8,
    pk_len: usize,
    hwid_ptr: *const u8,
    hwid_len: usize,
) -> *mut u8 {
    let payload = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(payload_ptr, payload_len)) };
    let pk_hex = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(pk_ptr, pk_len)) };
    
    let hwid = if hwid_len > 0 {
        Some(unsafe { std::slice::from_raw_parts(hwid_ptr, hwid_len) }.to_vec())
    } else {
        None
    };

    let dc = DarkstarCrypt::new();
    let result = match dc.encrypt(payload, pk_hex, hwid, false) {
        Ok(json) => json,
        Err(e) => format!("{{\"error\":\"{}\"}}", e),
    };

    let mut buf = result.into_bytes();
    buf.push(0);
    buf.shrink_to_fit();
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn wasm_decrypt(
    data_ptr: *const u8,
    data_len: usize,
    sk_ptr: *const u8,
    sk_len: usize,
    hwid_ptr: *const u8,
    hwid_len: usize,
) -> *mut u8 {
    let payload = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(data_ptr, data_len)) };
    let sk_hex = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(sk_ptr, sk_len)) };
    
    let hwid = if hwid_len > 0 {
        Some(unsafe { std::slice::from_raw_parts(hwid_ptr, hwid_len) }.to_vec())
    } else {
        None
    };

    let dc = DarkstarCrypt::new();
    let result = match dc.decrypt(payload, sk_hex, hwid, false) {
        Ok(res) => res,
        Err(e) => format!("{{\"error\":\"{}\"}}", e),
    };

    let mut buf = result.into_bytes();
    buf.push(0);
    buf.shrink_to_fit();
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}
