import subprocess
import json
import re
import os

def run_cmd(cmd, cwd):
    print(f"Running: {cmd} in {cwd}")
    result = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None
    return result.stdout

def main():
    rust_dir = r"x:\Projects\darkstar\d-asp\rust"
    go_dir = r"x:\Projects\darkstar\d-asp\go"
    node_dir = r"x:\Projects\darkstar\d-asp\node"
    python_dir = r"x:\Projects\darkstar\d-asp\python"
    hwid = "1111111111111111111111111111111111111111111111111111111111111111"
    payload = "test interop payload apple banana cherry"

    print("--- Step 1: Rust Keygen (D-ASP) ---")
    keygen_out = run_cmd("cargo run -- keygen", rust_dir)
    if not keygen_out: return
    
    pk = re.search(r"PK: ([0-9a-f]+)", keygen_out).group(1)
    sk = re.search(r"SK: ([0-9a-f]+)", keygen_out).group(1)
    print(f"PK Length: {len(pk)//2}, SK Length: {len(sk)//2}")

    print("\n--- Step 2: Rust Encrypt (D-ASP) ---")
    encrypt_out = run_cmd(f'cargo run -- encrypt "{payload}" {pk} --hwid {hwid}', rust_dir)
    if not encrypt_out: return
    
    enc_payload = encrypt_out.strip()
    print("Encryption successful.")

    print("\n--- Step 3: Go Decrypt (D-ASP) ---")
    # Updated: removed -v 9
    with open(os.path.join(go_dir, "interop.json"), "w") as f:
        f.write(enc_payload)
    
    # Executing the binary (main)
    decrypt_out = run_cmd(f'.\main.exe decrypt "@interop.json" {sk} --hwid {hwid}', go_dir)
    if not decrypt_out: return
    
    print(f"Decryption Output: '{decrypt_out.strip()}'")
    
    print("\n--- Step 4: Node.js Decrypt (D-ASP) ---")
    with open(os.path.join(node_dir, "interop.json"), "w") as f:
        f.write(enc_payload)
    node_out = run_cmd(f'node darkstar_crypt.js decrypt "@interop.json" {sk} --hwid {hwid}', node_dir)
    if not node_out: return
    print(f"Node.js Decryption Output: '{node_out.strip()}'")

    print("\n--- Step 5: Python Decrypt (D-ASP) ---")
    with open(os.path.join(python_dir, "interop.json"), "w") as f:
        f.write(enc_payload)
    python_out = run_cmd(f'python darkstar_crypt.py decrypt "@interop.json" {sk} --hwid {hwid}', python_dir)
    if not python_out: return
    print(f"Python Decryption Output: '{python_out.strip()}'")

    if decrypt_out.strip() == payload and node_out.strip() == payload and python_out.strip() == payload:
        print("\nINTEROP RESULT: ALL PASSED (D-ASP Bit-Perfect Pairty)")
    else:
        print("\nINTEROP RESULT: FAILED (D-ASP Mismatch)")

if __name__ == "__main__":
    main()
