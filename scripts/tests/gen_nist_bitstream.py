import subprocess
import json
import os
import sys

def get_engine_cmd():
    rust_exe = os.path.join("rust", "target", "release", "d-asp.exe")
    if os.path.exists(rust_exe):
        return [rust_exe]
    return None

def run_keygen(engine_cmd):
    res = subprocess.run(engine_cmd + ["keygen"], capture_output=True, text=True)
    pk, sk = "", ""
    for line in res.stdout.split('\n'):
        if line.startswith("PK:"): pk = line.split("PK:")[1].strip()
        if line.startswith("SK:"): sk = line.split("SK:")[1].strip()
    return pk, sk

def run_encrypt_to_bin(engine_cmd, payload_size_mb, pk, out_file):
    print(f"Generating {payload_size_mb}MB of highly structured internal state to force maximum diffusion...")
    # Generate structured data (all zeros) to ensure the cipher is doing all the entropy work
    tmp_file = os.path.abspath("tmp_nist_payload.txt")
    with open(tmp_file, "wb") as f:
        # 1 MB blocks
        for _ in range(payload_size_mb):
            f.write(b"\x00" * (1024 * 1024))
            
    print("Executing Rust Engine Cryptographic Cascade...")
    res = subprocess.run(engine_cmd + ["encrypt", f"@{tmp_file}", pk], capture_output=True, text=True)
    
    if os.path.exists(tmp_file):
        os.remove(tmp_file)
        
    try:
        lines = res.stdout.strip().split('\n')
        ct_hex = None
        for line in reversed(lines):
            if line.startswith('{'):
                ct_hex = json.loads(line)["data"]
                break
        if not ct_hex:
            ct_hex = json.loads(res.stdout.strip())["data"]
            
        print(f"Writing {len(ct_hex)//2} bytes to {out_file}...")
        with open(out_file, "wb") as f:
            f.write(bytes.fromhex(ct_hex))
        print("Success! NIST SP 800-22 binary file generated.")
    except Exception as e:
        print("Error parsing encryption output:", e)
        sys.exit(1)

def main():
    engine_cmd = get_engine_cmd()
    if not engine_cmd:
        print("Error: Rust engine not built.")
        sys.exit(1)
        
    out_dir = "out-releases"
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
        
    out_file = os.path.join(out_dir, "nist_bitstream.bin")
    
    print("Generating ML-KEM-1024 Keypair...")
    pk, sk = run_keygen(engine_cmd)
    
    # Generate 10MB of continuous ciphertext
    # (In standard operations, 10MB - 100MB is used for full NIST suites)
    # We use 10MB to keep generation time around ~5-10 seconds for the CLI tool
    run_encrypt_to_bin(engine_cmd, 10, pk, out_file)
    
if __name__ == "__main__":
    main()
