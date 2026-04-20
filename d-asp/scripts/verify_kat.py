import subprocess
import json
import os
import time
import sys
from datetime import datetime

# --- Configuration & Paths ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSION_ID = datetime.now().strftime("%Y%m%d_%H%M%S")
ROOT_LOG_DIR = os.path.join(BASE_DIR, "logs")
LOG_DIR = os.path.join(ROOT_LOG_DIR, f"kat_{SESSION_ID}")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR, exist_ok=True)

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
        "cmd": ["node", os.path.join(BASE_DIR, "node", "dasp.js")],
    },
            "Python": {
        "cwd": os.path.join(BASE_DIR, "python"),
        "cmd": ["python", os.path.join(BASE_DIR, "python", "dasp.py")],
    },
    "C": {
        "cwd": os.path.join(BASE_DIR, "c"),
        "cmd": [os.path.join(BASE_DIR, "c", "dasp.exe")],
    }
}

KAT_LOG_PATH = os.path.join(LOG_DIR, "kat_report.log")

def log(msg):
    timestamp = datetime.now().isoformat()
    line = f"[{timestamp}] {msg}\n"
    with open(KAT_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line)
    print(msg)

def run_decrypt(engine_name, ciphertext_json, sk_hex, hwid, use_diagnostic=True):
    engine = ENGINES[engine_name]
    ct_json_str = json.dumps(ciphertext_json)
    
    # Write absolute paths to temp files to avoid CLI length limits
    sk_file = os.path.join(engine["cwd"], "tmp_sk.hex")
    with open(sk_file, "w") as f: f.write(sk_hex)
    sk_path_abs = os.path.abspath(sk_file)
    
    data_file = os.path.join(engine["cwd"], "tmp_data.json")
    with open(data_file, "w") as f: f.write(ct_json_str)
    data_path_abs = os.path.abspath(data_file)
    
    cmd = engine["cmd"] + ["decrypt", f"@{data_path_abs}", f"@{sk_path_abs}"]
    if hwid:
        hwid_file = os.path.join(engine["cwd"], "tmp_hwid.hex")
        with open(hwid_file, "w") as f: f.write(hwid)
        hwid_path_abs = os.path.abspath(hwid_file)
        cmd += ["--hwid", f"@{hwid_path_abs}"]
        
    if use_diagnostic and engine_name != "C":
        cmd += ["--diagnostic"]
        
    try:
        res = subprocess.run(cmd, cwd=engine["cwd"], capture_output=True, text=True, timeout=30)
        # Cleanup
        if os.path.exists(os.path.join(engine["cwd"], "tmp_sk.hex")): os.remove(os.path.join(engine["cwd"], "tmp_sk.hex"))
        if os.path.exists(os.path.join(engine["cwd"], "tmp_data.json")): os.remove(os.path.join(engine["cwd"], "tmp_data.json"))
        if os.path.exists(os.path.join(engine["cwd"], "tmp_hwid.hex")): os.remove(os.path.join(engine["cwd"], "tmp_hwid.hex"))

        if res.returncode != 0:
            # Dump all output for diagnosis
            diag_lines = [l for l in res.stdout.splitlines() if "diagnostics" in l]
            diag_str = " | ".join(diag_lines) if diag_lines else "no_diagnostics"
            log(f"KAT ERROR [{engine_name}]: {res.stderr.strip()} | stdout_diag: {diag_str}")
            return f"ERROR: {res.stderr}", {}
        
        out = res.stdout
        if out.endswith("\n"): out = out[:-1]
        if out.endswith("\r"): out = out[:-1]
        
        # Filter out diagnostic lines, find actual payload
        output_lines = [l for l in out.splitlines() if not l.startswith("{\"diagnostics\"")]
        out = output_lines[-1].strip() if output_lines else ""
        
        # Parse diagnostics from stderr
        diagnostics = {}
        for line in res.stderr.splitlines():
            try:
                d_obj = json.loads(line)
                if "diagnostics" in d_obj:
                    diagnostics = d_obj["diagnostics"]
                    break
            except: continue
        # Also parse diagnostics from stdout
        for line in res.stdout.splitlines():
            try:
                d_obj = json.loads(line)
                if "diagnostics" in d_obj:
                    diagnostics.update(d_obj["diagnostics"])
            except: continue
            
        return out, diagnostics
    except subprocess.TimeoutExpired:
        log(f"KAT TIMEOUT [{engine_name}]")
        return "ERROR: timeout", {}

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
                if engine != "C":
                    for stage_name, key in stages:
                        v_exp = expected_diag.get(key)
                        v_act = actual_diag.get(key)
                        if v_exp != v_act:
                            error_msg = f"{stage_name} Mismatch"
                            log(f"    DEBUG: {stage_name} expected {v_exp}, got {v_act}")
                            break

                # Strip both for robust comparison (handles trailing spaces in long payloads)
                if actual_payload.strip() != expected_payload.strip():
                    error_msg = f"Payload expected '{expected_payload}', got '{actual_payload}'"
                    log(f"    DEBUG: {error_msg}")
                    
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
