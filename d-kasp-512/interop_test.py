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
    rust_dir = r"x:\Projects\darkstar\d-kasp-512\rust"
    go_dir = r"x:\Projects\darkstar\d-kasp-512\go"
    node_dir = r"x:\Projects\darkstar\d-kasp-512\node"
    hwid = "1111111111111111111111111111111111111111111111111111111111111111"
    mnemonic = "test interop mnemonic apple banana cherry"

    print("--- Step 1: Rust Keygen ---")
    keygen_out = run_cmd("cargo run -- keygen", rust_dir)
    if not keygen_out: return
    
    pk = re.search(r"PK: ([0-9a-f]+)", keygen_out).group(1)
    sk = re.search(r"SK: ([0-9a-f]+)", keygen_out).group(1)
    print(f"PK Length: {len(pk)//2}, SK Length: {len(sk)//2}")

    print("\n--- Step 2: Rust Encrypt ---")
    # Updated: removed -v 9
    encrypt_out = run_cmd(f'cargo run -- encrypt "{mnemonic}" {pk} --hwid {hwid}', rust_dir)
    if not encrypt_out: return
    
    json_match = re.search(r"(\{.*\})", encrypt_out)
    if not json_match:
        print("No JSON found in encryption output")
        return
    res_json = json_match.group(1)
    
    res_data = json.loads(res_json)
    enc_payload = json.dumps(res_data["encryptedData"])
    print("Encryption successful.")

    print("\n--- Step 3: Go Decrypt ---")
    # Updated: removed -v 9
    with open(os.path.join(go_dir, "interop.json"), "w") as f:
        f.write(enc_payload)
    
    # Assuming the binary is built as d-kasp-512.exe
    decrypt_out = run_cmd(f'.\d-kasp-512.exe decrypt "@interop.json" {sk} --hwid {hwid}', go_dir)
    if not decrypt_out: return
    
    print(f"Decryption Output: '{decrypt_out.strip()}'")
    
    print("\n--- Step 5: Python Decrypt ---")
    with open(os.path.join(node_dir, "..", "python", "interop.json"), "w") as f:
        f.write(enc_payload)
    python_out = run_cmd(f'python darkstar_crypt.py decrypt "@interop.json" {sk}', os.path.join(node_dir, "..", "python"))
    if not python_out: return
    print(f"Python Decryption Output: '{python_out.strip()}'")

    if decrypt_out.strip() == mnemonic and node_out.strip() == mnemonic and python_out.strip() == mnemonic:
        print("\nINTEROP RESULT: ALL PASSED (Bit-Perfect Cross-Engine Match)")
    else:
        print("\nINTEROP RESULT: FAILED (Mismatch)")

if __name__ == "__main__":
    main()
