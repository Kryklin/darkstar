import subprocess
import json
import os

RUST_BIN = r"x:\Projects\darkstar\d-asp\rust\target\release\d-asp.exe"
RUST_CWD = r"x:\Projects\darkstar\d-asp\rust"

def run_rust(args):
    try:
        res = subprocess.run([RUST_BIN] + args, cwd=RUST_CWD, capture_output=True, text=True, check=True)
        out = res.stdout
        if out.endswith("\n"): out = out[:-1]
        if out.endswith("\r"): out = out[:-1]
        return out, res.stderr
    except subprocess.CalledProcessError as e:
        print(f"ERROR running Rust: {e.stderr}")
        raise

def main():
    print("Generating KAT Master Key...")
    keygen_out, _ = run_rust(["keygen"])
    # Robustly find PK and SK lines
    pk, sk = None, None
    for line in keygen_out.strip().splitlines():
        if "PK: " in line: pk = line.split("PK: ")[1].strip()
        if "SK: " in line: sk = line.split("SK: ")[1].strip()
    
    if not pk or not sk:
        raise ValueError(f"Failed to find PK/SK in keygen output: {keygen_out}")
    
    vectors = []
    
    test_cases = [
        {"id": "V1_STD", "payload": "Darkstar Professional Grade KAT Vector 001", "hwid": None},
        {"id": "V2_IDB", "payload": "Darkstar Identity Bound KAT Vector 002", "hwid": "00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"},
        {"id": "V3_LNG", "payload": "Long KAT Payload: " + ("ABCDEF " * 20), "hwid": "FFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100"}
    ]
    
    for tc in test_cases:
        print(f"Generating Vector {tc['id']}...")
        # Write absolute paths to temp files to avoid CLI length limits
        pk_file = os.path.join(RUST_CWD, "tmp_pk.hex")
        with open(pk_file, "w") as f: f.write(pk)
        pk_path_abs = os.path.abspath(pk_file)
        
        args = ["encrypt", tc["payload"], f"@{pk_path_abs}", "--diagnostic"]
        if tc["hwid"]:
            hwid_file = os.path.join(RUST_CWD, "tmp_hwid.hex")
            with open(hwid_file, "w") as f: f.write(tc["hwid"])
            hwid_path_abs = os.path.abspath(hwid_file)
            args += ["--hwid", f"@{hwid_path_abs}"]
        
        enc_json_raw, diag_raw = run_rust(args)
        
        # Cleanup temp files
        if os.path.exists(pk_path_abs): os.remove(pk_path_abs)
        hwid_path_tmp = os.path.abspath(os.path.join(RUST_CWD, "tmp_hwid.hex"))
        if tc["hwid"] and os.path.exists(hwid_path_tmp):
             os.remove(hwid_path_tmp)
        
        enc_json = json.loads(enc_json_raw)
        
        # Parse diagnostics from stderr
        diagnostics = {}
        for line in diag_raw.splitlines():
            try:
                d_obj = json.loads(line)
                if "diagnostics" in d_obj:
                    diagnostics = d_obj["diagnostics"]
                    break
            except: continue

        vectors.append({
            "vector_id": tc["id"],
            "pk": pk,
            "sk": sk,
            "hwid": tc["hwid"],
            "payload": tc["payload"],
            "ciphertext_json": enc_json,
            "diagnostics": diagnostics
        })
        
    output_path = os.path.join(os.path.dirname(__file__), "kat_vectors.json")
    with open(output_path, "w") as f:
        json.dump(vectors, f, indent=2)
    
    print(f"Successfully generated {len(vectors)} vectors in {output_path}")

if __name__ == "__main__":
    main()
