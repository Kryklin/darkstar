import subprocess
import json
import sys
import os

# Configuration
# Dynamic path resolution to handle different drives/environments
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ["go", "rust", "python", "node"]

CLI_COMMANDS = {
    "go": ["go", "run", "-C", os.path.join(PROJECT_ROOT, "go"), "."],
    "rust": ["cargo", "run", "--manifest-path", os.path.join(PROJECT_ROOT, "rust", "Cargo.toml"), "--quiet", "--release", "--"],
    "python": ["python", "-u", os.path.join(PROJECT_ROOT, "python", "darkstar_crypt.py")],
    "node": ["node", os.path.join(PROJECT_ROOT, "node", "darkstar_crypt.js")]
}

TEST_MNEMONIC = "apple banana cherry date elderberry fig grape honeydew"
TEST_PASSWORD = "Strong!Password#2026"

def run_cli(lang, args):
    cmd = CLI_COMMANDS[lang] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error running {lang} {args}: {result.stderr}")
        return None
    return result.stdout.strip()

def main():
    print(f"=== Darkstar Cross-Language Interop Verification ===")
    print(f"Mnemonic: {TEST_MNEMONIC}")
    print(f"Password: {TEST_PASSWORD}")
    print("-" * 50)

    total_tests = 0
    passed_tests = 0

    for src_lang in LANGS:
        print(f"\n[Source: {src_lang.upper()}]")
        
        # 1. Encrypt with source
        print(f"  Encrypting with {src_lang}...")
        encrypt_output = run_cli(src_lang, ["encrypt", TEST_MNEMONIC, TEST_PASSWORD])
        if not encrypt_output:
            print(f"  FAILED: Could not encrypt with {src_lang}")
            continue

        try:
            # Handle potential extra text before JSON in some implementations (though we tried to avoid it)
            # Find the first { and last }
            start = encrypt_output.find('{')
            end = encrypt_output.rfind('}') + 1
            res_json = json.loads(encrypt_output[start:end])
            
            encrypted_data = res_json["encryptedData"]
            reverse_key = res_json["reverseKey"]
        except Exception as e:
            print(f"  FAILED: Could not parse JSON from {src_lang}. Output: {encrypt_output}")
            continue

        # 2. Decrypt with all
        for dest_lang in LANGS:
            total_tests += 1
            print(f"  Decrypting with {dest_lang}...", end=" ")
            
            decrypt_output = run_cli(dest_lang, ["decrypt", encrypted_data, reverse_key, TEST_PASSWORD])
            
            if decrypt_output == TEST_MNEMONIC:
                print("PASSED")
                passed_tests += 1
            else:
                print(f"FAILED")
                print(f"    Expected: {TEST_MNEMONIC}")
                print(f"    Got:      {decrypt_output}")

    print("\n" + "=" * 50)
    print(f"Tests Run:    {total_tests}")
    print(f"Tests Passed: {passed_tests}")
    
    if passed_tests == total_tests:
        print("INTEROP VERIFICATION SUCCESSFUL!")
    else:
        print("INTEROP VERIFICATION FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    main()
