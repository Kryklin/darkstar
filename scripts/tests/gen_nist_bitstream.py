import os
import sys
import json
import subprocess

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    out_dir = os.path.join(root_dir, 'out-releases')
    os.makedirs(out_dir, exist_ok=True)
    
    engine_path = os.path.join(root_dir, 'rust', 'target', 'release', 'd-asp.exe')
    
    if not os.path.exists(engine_path):
        engine_path = os.path.join(root_dir, 'c', 'dasp.exe')
        if not os.path.exists(engine_path):
            print("Error: Could not find Rust or C engine executable.")
            sys.exit(1)

    print(f"Using engine: {engine_path}")

    # 1. Generate Keypair
    print("Generating NIST-compliant ML-KEM keys...")
    res = subprocess.run([engine_path, 'keygen'], capture_output=True, text=True, cwd=root_dir)
    if res.returncode != 0:
        print(f"Keygen failed:\n{res.stderr}")
        sys.exit(1)

    pk = None
    for line in res.stdout.splitlines():
        if line.startswith("PK:"):
            pk = line.split("PK:")[1].strip()
            
    if not pk:
        print("Failed to parse PK from output.")
        sys.exit(1)

    # 2. Create 10MB of zeros (for pure CTR stream output)
    print("Preparing 10MB payload...")
    payload_file = os.path.join(root_dir, 'tmp_nist_payload.bin')
    with open(payload_file, 'wb') as f:
        f.write(b'\x00' * (10 * 1024 * 1024))

    # 3. Encrypt payload
    print("Encrypting payload through ASP Cascade 16 (this may take a few seconds)...")
    res = subprocess.run([engine_path, 'encrypt', f'@{payload_file}', pk], capture_output=True, text=True, cwd=root_dir)
    
    try:
        if os.path.exists(payload_file):
            os.remove(payload_file)
    except Exception as e:
        print(f"Warning: Could not remove temporary payload file: {e}")

    if res.returncode != 0:
        print(f"Encryption failed:\n{res.stderr}")
        sys.exit(1)

    # 4. Parse JSON & Write Output
    print("Extracting generated ciphertext...")
    
    # Try finding the JSON payload on the last line
    json_str = None
    for line in reversed(res.stdout.splitlines()):
        if line.strip().startswith('{'):
            json_str = line.strip()
            break

    if not json_str:
        print("Failed to parse JSON output from engine.")
        sys.exit(1)

    try:
        data = json.loads(json_str)
        ct_hex = data.get('data')
        if not ct_hex:
            print("No 'data' field found in JSON.")
            sys.exit(1)
            
        ct_bytes = bytes.fromhex(ct_hex)
        out_file = os.path.join(out_dir, 'nist_bitstream.bin')
        
        with open(out_file, 'wb') as f:
            f.write(ct_bytes)
            
        print(f"Successfully wrote {len(ct_bytes) / (1024*1024):.2f} MB of ciphertext to out-releases/nist_bitstream.bin")
        
    except Exception as e:
        print(f"Error processing JSON payload: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
