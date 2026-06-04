import subprocess
import json
import os

C_BIN = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "rust", "target", "release", "d-asp.exe")
C_CWD = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "rust")

def run_engine(bin_path, cwd, args):
    res = subprocess.run([bin_path] + args, cwd=cwd, capture_output=True, text=True, encoding='utf-8', timeout=60)
    out = res.stdout
    if out.endswith("\n"): out = out[:-1]
    if out.endswith("\r"): out = out[:-1]
    if res.returncode != 0:
        print(f"ERROR: {res.stderr}")
        raise RuntimeError(f"Engine {bin_path} returned {res.returncode}")
    return out, res.stderr

def main():
    print("Generating Master KAT Key using Rust Reference Engine...")
    keygen_out, _ = run_engine(C_BIN, C_CWD, ["keygen"])
    
    lines = keygen_out.splitlines()
    pk = lines[0].split(": ")[1]
    sk = lines[1].split(": ")[1]
    if not pk or not sk:
        raise ValueError(f"Failed to find PK/SK in keygen output:\n{keygen_out}")
    
    print(f"PK length: {len(pk)//2} bytes, SK length: {len(sk)//2} bytes")
    
    vectors = []
    
    test_cases = [
        {"id": "V1_STD", "payload": "Darkstar Professional Grade KAT Vector 001", "hwid": None},
        {"id": "V2_IDB", "payload": "Darkstar Identity Bound KAT Vector 002", "hwid": "00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"},
        {"id": "V3_LNG", "payload": "Long KAT Payload: " + ("ABCDEF " * 20).rstrip(), "hwid": "FFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100"}
    ]
    
    for tc in test_cases:
        print(f"Generating Vector {tc['id']} using Rust engine encrypt...")
        
        pk_file = os.path.join(C_CWD, "tmp_pk.hex")
        with open(pk_file, "w") as f: f.write(pk)
        
        args = ["--diagnostic", "encrypt", tc["payload"], f"@{pk_file}", "--telemetry"]
        if tc["hwid"]:
            hwid_file = os.path.join(C_CWD, "tmp_hwid.hex")
            with open(hwid_file, "w") as f: f.write(tc["hwid"])
            args += ["--hwid", f"@{hwid_file}"]
        
        enc_json_raw, diag_raw = run_engine(C_BIN, C_CWD, args)
        
        # Filter diagnostic lines from stdout
        output_lines = [l for l in enc_json_raw.splitlines() if not l.startswith("{\"diagnostics\"")]
        enc_json_raw = output_lines[-1].strip() if output_lines else enc_json_raw
        
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
        
        # Cleanup
        for tmp in [os.path.join(C_CWD, "tmp_pk.hex"), os.path.join(C_CWD, "tmp_hwid.hex")]:
            if os.path.exists(tmp): os.remove(tmp)
        
    output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "kat_vectors.json")
    with open(output_path, "w") as f:
        json.dump(vectors, f, indent=2)
    
    print(f"\nSuccessfully generated {len(vectors)} vectors in {output_path}")
    print("NOTE: KAT vectors use Rust-native ML-KEM-1024 keypair + Rust encrypt.")
    print("All engines decrypt to validate SPNA cascade parity.")

if __name__ == "__main__":
    main()
