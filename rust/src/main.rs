/*
 * D-ASP (ASP Cascade 16)
 * Implementation: Rust (Reference "Gold" Implementation)
 */

use ml_kem::{EncodedSizeUser, KemCore, MlKem1024};
pub mod engine;
use engine::DarkstarCrypt;

fn print_usage() {
    println!("Usage: darkstar <command> [args]");
    println!("Commands:");
    println!("  encrypt <payload> <pk_hex>   Encrypt using D-ASP");
    println!("  decrypt <json_data> <sk_hex> Decrypt using D-ASP");
    println!("  rebind <payload> <sk> <new_pk> Rebind a payload to a new key/HWID");
    println!("  keygen                       Generate ML-KEM-1024 keys");
    println!("  test                         Run D-ASP self-test");
}

fn clean_hex(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_hexdigit()).collect()
}

fn resolve_arg(arg: &str) -> String {
    if let Some(stripped) = arg.strip_prefix('@') {
        let path = std::path::Path::new(stripped);
        let content = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("Error reading argument @file '{}': {}", path.display(), e));
        content.trim().to_string()
    } else {
        arg.to_string()
    }
}

fn main() {
    let mut raw_args: Vec<String> = std::env::args().skip(1).collect();
    let mut hwid: Option<Vec<u8>> = None;
    let mut new_hwid: Option<Vec<u8>> = None;
    let mut telemetry = false;

    let mut i = 0;
    while i < raw_args.len() {
        if raw_args[i] == "--hwid" && i + 1 < raw_args.len() {
            let hw_hex = resolve_arg(&raw_args.remove(i + 1));
            raw_args.remove(i);
            hwid = Some(hex::decode(clean_hex(&hw_hex)).expect("Invalid HWID hex"));
        } else if raw_args[i] == "--new-hwid" && i + 1 < raw_args.len() {
            let hw_hex = resolve_arg(&raw_args.remove(i + 1));
            raw_args.remove(i);
            new_hwid = Some(hex::decode(clean_hex(&hw_hex)).expect("Invalid New HWID hex"));
        } else if raw_args[i] == "--diagnostic" {
            raw_args.remove(i);
            std::env::set_var("DASP_DIAGNOSTIC", "1");
        } else if raw_args[i] == "--telemetry" {
            raw_args.remove(i);
            telemetry = true;
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
            if raw_args.len() < 2 {
                print_usage();
                return;
            }
            let payload = resolve_arg(&raw_args[0]);
            let pk_hex = resolve_arg(&raw_args[1]);

            match dc.encrypt(&payload, &pk_hex, hwid, telemetry) {
                Ok(res_json) => println!("{}", res_json),
                Err(e) => {
                    eprintln!("Encryption Failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "decrypt" => {
            if raw_args.len() < 2 {
                print_usage();
                return;
            }
            let data = resolve_arg(&raw_args[0]);
            let sk_hex = resolve_arg(&raw_args[1]);

            match dc.decrypt(&data, &sk_hex, hwid, telemetry) {
                Ok(decrypted) => println!("{}", decrypted),
                Err(e) => {
                    eprintln!("Decryption Failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "rebind" => {
            if raw_args.len() < 3 {
                print_usage();
                return;
            }
            let data = resolve_arg(&raw_args[0]);
            let sk_hex = resolve_arg(&raw_args[1]);
            let pk_hex = resolve_arg(&raw_args[2]);

            match dc.decrypt(&data, &sk_hex, hwid, telemetry) {
                Ok(mut decrypted) => {
                    match dc.encrypt(&decrypted, &pk_hex, new_hwid, telemetry) {
                        Ok(res_json) => {
                            println!("{}", res_json);
                        }
                        Err(e) => {
                            eprintln!("Rebind Encryption Failed: {}", e);
                            std::process::exit(1);
                        }
                    }
                    unsafe {
                        std::ptr::write_bytes(decrypted.as_mut_ptr(), 0, decrypted.len());
                    }
                }
                Err(e) => {
                    eprintln!("Rebind Decryption Failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "keygen" => {
            let (dk, ek) = MlKem1024::generate(&mut rand::thread_rng());
            println!("PK: {}", hex::encode(ek.as_bytes()));
            println!("SK: {}", hex::encode(dk.as_bytes()));
        }
        "test" => {
            let payload = "apple banana cherry date elderberry fig grape honeydew";
            let (dk, ek) = MlKem1024::generate(&mut rand::thread_rng());
            let pk_hex = hex::encode(ek.as_bytes());
            let sk_hex = hex::encode(dk.as_bytes());

            println!("--- D-ASP Self-Test ---");
            match dc.encrypt(payload, &pk_hex, None, telemetry) {
                Ok(res_json) => {
                    println!("Encrypted: {}", res_json);

                    match dc.decrypt(&res_json, &sk_hex, None, telemetry) {
                        Ok(decrypted) => {
                            println!("Decrypted: '{}'", decrypted);
                            if decrypted == payload {
                                println!("Result: PASSED");
                            } else {
                                println!("Result: FAILED (mismatch)");
                                std::process::exit(1);
                            }
                        }
                        Err(e) => {
                            eprintln!("Test Decryption Failed: {}", e);
                            std::process::exit(1);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Test Encryption Failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        _ => {
            eprintln!("Error: Unknown command '{}'", command);
            print_usage();
            std::process::exit(1);
        }
    }
}
