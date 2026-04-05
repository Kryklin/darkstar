import subprocess
import json
import sys
import os
import shutil
import time

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ["go", "rust", "python", "node"]

GO_BIN = shutil.which("go") or r"C:\Program Files\Go\bin\go.exe"
CARGO_BIN = shutil.which("cargo") or "cargo"
PYTHON_BIN = shutil.which("python") or "python"
NODE_BIN = shutil.which("node") or "node"

CLI_COMMANDS = {
    "go": [GO_BIN, "run", "."],
    "rust": [os.path.join(PROJECT_ROOT, "rust", "target", "release", "d-kasp-512.exe")],
    "python": [PYTHON_BIN, "-u", os.path.join(PROJECT_ROOT, "python", "darkstar_crypt.py")],
    "node": [NODE_BIN, os.path.join(PROJECT_ROOT, "node", "darkstar_crypt.js")]
}

# Directories to run commands in
CLI_CWD = {
    "go": os.path.join(PROJECT_ROOT, "go"),
    "rust": PROJECT_ROOT,
    "python": PROJECT_ROOT,
    "node": PROJECT_ROOT
}

TEST_MNEMONIC = "apple banana cherry date elderberry fig grape honeydew"
TEST_PASSWORD = "Strong!Password#2026"

def run_cli(lang, args):
    # Ensure all args are strings (especially if they were parsed from JSON)
    str_args = []
    for a in args:
        if isinstance(a, (dict, list)):
            str_args.append(json.dumps(a))
        else:
            str_args.append(str(a))
            
    cmd = CLI_COMMANDS[lang] + str_args
    cwd = CLI_CWD.get(lang, PROJECT_ROOT)
    
    start_time = time.perf_counter()
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, encoding="utf-8", errors="replace")
    elapsed = time.perf_counter() - start_time
    
    if result.returncode != 0:
        return f"ERROR: {result.stderr.strip()}", elapsed
    return result.stdout.strip(), elapsed

def main():
    start_suite = time.perf_counter()
    print(f"=== d-kasp-512 Cross-Language Interop Verification ===")
    print(f"Mnemonic: {TEST_MNEMONIC}")
    print(f"Password: {TEST_PASSWORD}")
    print("-" * 50)

    total_tests = 0
    passed_tests = 0
    versions = ["5", "4", "3", "2", "1"]

    for version in versions:
        version_label = f"d-kasp-512 (V{version})"
        print(f"\n{'='*20} Testing {version_label} {'='*20}")
        
        v5_pk = ""
        v5_sk = ""
        if version == "5":
            print("  Generating ML-KEM-1024 Keypair (using Python)...", end=" ", flush=True)
            keygen_out, elapsed = run_cli("python", ["-v", "5", "keygen"])
            if not keygen_out:
                print(f"FAILED ({elapsed:.3f}s)")
                continue
            print(f"DONE ({elapsed:.3f}s)")
            lines = [l for l in keygen_out.split('\n') if ':' in l]
            v5_pk = lines[0].split(': ')[1].strip()
            v5_sk = lines[1].split(': ')[1].strip()
            print(f"  PK: {v5_pk[:16]}...{v5_pk[-16:]}")

        for src_lang in LANGS:
            print(f"\n  [Source: {src_lang.upper()} V{version}]")
            
            encrypt_pass = v5_pk if version == "5" else TEST_PASSWORD
            decrypt_pass = v5_sk if version == "5" else TEST_PASSWORD
            
            # 1. Encrypt with source
            print(f"  Encrypting with {src_lang}...", end=" ", flush=True)
            encrypt_output, elapsed = run_cli(src_lang, ["-v", version, "encrypt", TEST_MNEMONIC, encrypt_pass])
            
            if not encrypt_output:
                print(f"FAILED ({elapsed:.3f}s)")
                continue
            print(f"DONE ({elapsed:.3f}s)")

            try:
                # Find the first { and last } to isolate JSON
                start = encrypt_output.find('{')
                end = encrypt_output.rfind('}') + 1
                if start == -1 or end == 0:
                    raise ValueError("No JSON found")
                res_json = json.loads(encrypt_output[start:end])
                
                encrypted_data = res_json["encryptedData"]
                # In modern versions, encryptedData might be a dict. stringify it for CLI args.
                if isinstance(encrypted_data, (dict, list)):
                    encrypted_data = json.dumps(encrypted_data)
                    
                reverse_key = res_json["reverseKey"]
                if isinstance(reverse_key, (dict, list)):
                    reverse_key = json.dumps(reverse_key)
            except Exception as e:
                print(f"  FAILED: Could not parse JSON from {src_lang}. Error: {e}")
                continue

            # 2. Decrypt with all
            for dest_lang in LANGS:
                total_tests += 1
                print(f"    -> Decrypt with {dest_lang.upper()}:", end=" ", flush=True)
                
                decrypt_output, elapsed = run_cli(dest_lang, ["-v", version, "decrypt", encrypted_data, reverse_key, decrypt_pass])
                
                if decrypt_output == TEST_MNEMONIC:
                    print(f"PASS ({elapsed:.3f}s)")
                    passed_tests += 1
                else:
                    print(f"FAILED ({elapsed:.3f}s)")
                    if decrypt_output:
                        print(f"        Got: {decrypt_output}")

    end_suite = time.perf_counter()
    print("\n" + "="*50)
    print(f"INTEROP VERIFICATION {'PASSED' if passed_tests == total_tests else 'FAILED'}!")
    print(f"Tests Run:    {total_tests}")
    print(f"Tests Passed: {passed_tests}")
    print(f"Total Time:   {end_suite - start_suite:.3f}s")
    print("="*50)

    if passed_tests != total_tests:
        sys.exit(1)

if __name__ == "__main__":
    main()

