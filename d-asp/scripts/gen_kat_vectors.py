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
    lines = keygen_out.splitlines()
    pk = lines[0].split(": ")[1]
    sk = lines[1].split(": ")[1]
    
    vectors = []
    
    test_cases = [
        {"id": "V1_STD", "payload": "Darkstar Professional Grade KAT Vector 001", "hwid": None},
        {"id": "V2_IDB", "payload": "Darkstar Identity Bound KAT Vector 002", "hwid": "00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"},
        {"id": "V3_LNG", "payload": "Long KAT Payload: " + ("ABCDEF " * 20), "hwid": "FFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100"}
    ]
    
    for tc in test_cases:
        print(f"Generating Vector {tc['id']}...")
        args = ["encrypt", tc["payload"], pk, "--diagnostic"]
        if tc["hwid"]:
            args += ["--hwid", tc["hwid"]]
        
        enc_json_raw, diag_raw = run_rust(args)
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
        
    with open("kat_vectors.json", "w") as f:
        json.dump(vectors, f, indent=2)
    
    print(f"Successfully generated {len(vectors)} vectors in kat_vectors.json")

if __name__ == "__main__":
    main()
