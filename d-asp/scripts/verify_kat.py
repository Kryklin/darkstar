import subprocess
import json
import os
import time
import sys
from datetime import datetime

# --- Configuration & Paths ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(os.path.dirname(__file__), "log")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

KAT_FILE = os.path.join(os.path.dirname(__file__), "kat_vectors.json")

ENGINES = {
    "Rust": {
        "cwd": os.path.join(BASE_DIR, "rust"),
        "cmd": [os.path.join(BASE_DIR, "rust", "target", "release", "d-asp.exe")],
    },
    "Go": {
        "cwd": os.path.join(BASE_DIR, "go"),
        "cmd": [os.path.join(BASE_DIR, "go", "main.exe")],
    },
    "Node": {
        "cwd": os.path.join(BASE_DIR, "node"),
        "cmd": ["node", os.path.join(BASE_DIR, "node", "darkstar_crypt.js")],
    },
    "Python": {
        "cwd": os.path.join(BASE_DIR, "python"),
        "cmd": ["python", os.path.join(BASE_DIR, "python", "darkstar_crypt.py")],
    }
}

SESSION_ID = datetime.now().strftime("%Y%m%d_%H%M%S")
KAT_LOG_PATH = os.path.join(LOG_DIR, f"kat_report_{SESSION_ID}.log")

def log(msg):
    timestamp = datetime.now().isoformat()
    line = f"[{timestamp}] {msg}\n"
    with open(KAT_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line)
    print(msg)

def run_decrypt(engine_name, ciphertext_json, sk_hex, hwid):
    engine = ENGINES[engine_name]
    cmd = engine["cmd"] + ["decrypt", "@kat_temp.json", sk_hex, "--diagnostic"]
    if hwid:
        cmd += ["--hwid", hwid]
    
    temp_path = os.path.join(engine["cwd"], "kat_temp.json")
    with open(temp_path, "w") as f:
        json.dump(ciphertext_json, f)
        
    try:
        res = subprocess.run(cmd, cwd=engine["cwd"], capture_output=True, text=True, check=True)
        out = res.stdout
        if out.endswith("\n"): out = out[:-1]
        if out.endswith("\r"): out = out[:-1]
        
        # Parse diagnostics from stderr
        diagnostics = {}
        for line in res.stderr.splitlines():
            try:
                d_obj = json.loads(line)
                if "diagnostics" in d_obj:
                    diagnostics = d_obj["diagnostics"]
                    break
            except: continue
            
        return out, diagnostics
    except subprocess.CalledProcessError as e:
        log(f"KAT ERROR [{engine_name}]: {e.stderr}")
        return f"ERROR: {e.stderr}", {}

def main():
    if not os.path.exists(KAT_FILE):
        print(f"Error: {KAT_FILE} not found. Run gen_kat_vectors.py first.")
        sys.exit(1)
        
    with open(KAT_FILE, "r") as f:
        vectors = json.load(f)
        
    log(f"--- D-ASP Known Answer Test (KAT) Session: {SESSION_ID} ---")
    log(f"Loaded {len(vectors)} test vectors.\n")
    
    summary = {}
    
    for vec in vectors:
        vid = vec["vector_id"]
        log(f"Verifying Vector: {vid} (HWID: {vec['hwid']})")
        expected_payload = vec["payload"]
        expected_diag = vec.get("diagnostics", {})
        
        for engine in ENGINES:
            actual_payload, actual_diag = run_decrypt(engine, vec["ciphertext_json"], vec["sk"], vec["hwid"])
            
            # 4-Stage Diagnostic Verification
            stages = [
                ("Stage 1 (Blended_SS)", "stage1_blended_ss"),
                ("Stage 2 (word_key)", "stage2_word_key"),
                ("Stage 3 (Round Indices)", "stage3_round_indices"),
                ("Stage 4 (MAC)", "stage4_mac")
            ]
            
            error_msg = None
            if actual_payload.startswith("ERROR:"):
                status = "FAIL (CLI ERROR)"
                error_msg = actual_payload
            else:
                for stage_name, key in stages:
                    v_exp = expected_diag.get(key)
                    v_act = actual_diag.get(key)
                    if v_exp != v_act:
                        error_msg = f"{stage_name} Mismatch"
                        log(f"    DEBUG: {stage_name} expected {v_exp}, got {v_act}")
                        break
                
                if not error_msg and actual_payload != expected_payload:
                    error_msg = "Payload Mismatch"
                    log(f"    DEBUG: Payload expected '{expected_payload}', got '{actual_payload}'")
                    
                if not error_msg:
                    status = "PASS"
                else:
                    status = f"FAIL ({error_msg})"
                
            log(f"  [{engine:<6}]: {status}")
            
            if engine not in summary: summary[engine] = {"pass": 0, "fail": 0}
            if status == "PASS":
                summary[engine]["pass"] += 1
            else:
                summary[engine]["fail"] += 1
        log("")

    log("--- KAT SUMMARY ---")
    all_passed = True
    sorted_engines = sorted(summary.keys())
    for engine in sorted_engines:
        stats = summary[engine]
        log(f"{engine:<10}: {stats['pass']} Passed / {stats['fail']} Failed")
        if stats["fail"] > 0: all_passed = False
        
    if all_passed:
        log("\nRESULT: ALL ENGINES ARE BIT-PERFECT SYNCHRONIZED.")
    else:
        log("\nRESULT: KAT FAILED. CROSS-LANGUAGE PARITY ERROR.")
        sys.exit(1)

if __name__ == "__main__":
    main()
