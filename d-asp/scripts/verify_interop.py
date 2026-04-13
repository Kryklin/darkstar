import subprocess
import json
import os
import time
import statistics
import sys
from datetime import datetime

# --- Configuration & Paths ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(os.path.dirname(__file__), "log")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# Engine Definitions
# Adjust binary names if they differ on your platform
ENGINES = {
    "Rust": {
        "cwd": os.path.join(BASE_DIR, "rust"),
        "cmd": [os.path.join(BASE_DIR, "rust", "target", "release", "d-asp.exe")],
        "type": "native"
    },
    "Go": {
        "cwd": os.path.join(BASE_DIR, "go"),
        "cmd": [os.path.join(BASE_DIR, "go", "main.exe")],
        "type": "native"
    },
    "Node": {
        "cwd": os.path.join(BASE_DIR, "node"),
        "cmd": ["node", os.path.join(BASE_DIR, "node", "darkstar_crypt.js")],
        "type": "managed"
    },
    "Python": {
        "cwd": os.path.join(BASE_DIR, "python"),
        "cmd": ["python", os.path.join(BASE_DIR, "python", "darkstar_crypt.py")],
        "type": "managed"
    }
}

SESSION_ID = datetime.now().strftime("%Y%m%d_%H%M%S")
SESSION_LOG_PATH = os.path.join(LOG_DIR, f"session_{SESSION_ID}.log")

def log(msg, to_console=True):
    timestamp = datetime.now().isoformat()
    line = f"[{timestamp}] {msg}\n"
    with open(SESSION_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line)
    if to_console:
        print(msg)

def run_cmd(cmd, cwd, input_data=None):
    try:
        start = time.perf_counter_ns()
        res = subprocess.run(cmd, cwd=cwd, input=input_data, capture_output=True, text=True, check=True)
        end = time.perf_counter_ns()
        
        # Parse internal timings from Stderr (Decrypt) or Stdout (Encrypt)
        internal_timings = None
        # Check stderr first (standard pattern for our instrumentation)
        for line in res.stderr.splitlines():
            if '"timings":' in line:
                try:
                    internal_timings = json.loads(line).get("timings")
                except: pass
        
        # If not in stderr, check if stdout is JSON containing it (Encrypt pattern)
        if not internal_timings:
            try:
                out_json = json.loads(res.stdout)
                if "timings" in out_json:
                    internal_timings = out_json["timings"]
            except: pass

        return res.stdout.strip(), end - start, internal_timings
    except subprocess.CalledProcessError as e:
        log(f"ERROR: Command failed: {' '.join(cmd)}\nStdout: {e.stdout}\nStderr: {e.stderr}")
        raise

def benchmark_engine(name, encrypted_payload, sk_hex, hwid):
    engine = ENGINES[name]
    cmd = engine["cmd"] + ["decrypt", "@interop.json", sk_hex, "--hwid", hwid]
    
    # Setup interop.json for this engine
    with open(os.path.join(engine["cwd"], "interop.json"), "w") as f:
        f.write(encrypted_payload)
        
    times = []
    internal_metrics = []
    output = ""
    # Warmup
    run_cmd(cmd, engine["cwd"])
    
    # Benchmark Rounds
    ROUNDS = 20
    for _ in range(ROUNDS):
        out, duration, it = run_cmd(cmd, engine["cwd"])
        times.append(duration)
        if it:
            internal_metrics.append(it)
        output = out
        
    return output, times, internal_metrics

def main():
    log(f"--- D-ASP Professional Performance Benchmark (Session: {SESSION_ID}) ---")
    
    # 1. Setup Test Data (using Rust as reference for keygen/encrypt)
    log("Step 1: Generating standard ML-KEM-1024 test vector...")
    keygen_out, _, _ = run_cmd(ENGINES["Rust"]["cmd"] + ["keygen"], ENGINES["Rust"]["cwd"])
    # Rust keygen output format: "PK: <hex>\nSK: <hex>"
    lines = keygen_out.splitlines()
    pk = lines[0].split(": ")[1]
    sk = lines[1].split(": ")[1]
    
    payload = "Professional Grade Benchmark Payload: 0123456789ABCDEF0123456789ABCDEF"
    hwid = "11223344556677889900AABBCCDDEEFF11223344556677889900AABBCCDDEEFF"
    
    log(f"Payload: '{payload}'")
    log(f"Identity Binding (HWID): {hwid[:16]}...")

    # 2. Encrypt using reference (Rust)
    log("Step 2: Creating reference ciphertext (Rust)...")
    enc_json, _, _ = run_cmd(ENGINES["Rust"]["cmd"] + ["encrypt", payload, pk, "--hwid", hwid], ENGINES["Rust"]["cwd"])
    
    # 3. Cross-Platform Benchmark
    log("\nStep 3: Executing Cross-Platform Benchmark (20 rounds each)...")
    results = {}
    
    for name in ENGINES:
        try:
            log(f"Benchmarking {name}...")
            decrypted, durations, internals = benchmark_engine(name, enc_json, sk, hwid)
            
            # Verify Parity
            if decrypted.strip() == payload:
                status = "PASSED"
            else:
                status = f"FAILED (Output: '{decrypted}')"
                
            results[name] = {
                "status": status,
                "durations_ns": durations,
                "internals": internals,
                "output": decrypted
            }
            
            # Save raw output log
            raw_log_path = os.path.join(LOG_DIR, f"engine_raw_{name}_{SESSION_ID}.json")
            with open(raw_log_path, "w") as f:
                f.write(decrypted)
                
        except Exception as e:
            log(f"Critical error benchmarking {name}: {e}")
            results[name] = {"status": f"ERROR: {e}", "durations_ns": [], "internals": []}

    # 4. Generate Performance Report
    report_path = os.path.join(LOG_DIR, f"performance_report_{SESSION_ID}.txt")
    with open(report_path, "w") as f:
        f.write(f"D-ASP PROFESSIONAL PERFORMANCE REPORT\n")
        f.write(f"Session: {SESSION_ID}\n")
        f.write(f"Timestamp: {datetime.now().isoformat()}\n")
        f.write(f"Protocol: Darkstar Algebraic Substitution & Permutation (D-ASP)\n")
        f.write(f"Anchor: ML-KEM-1024\n")
        f.write("-" * 90 + "\n\n")
        
        headers = f"{'Engine':<10} | {'Status':<7} | {'Mean (ms)':<10} | {'Kem (us)':<10} | {'Kdf (us)':<10} | {'Gaunt (us)':<10} | {'Ops/sec'}"
        f.write(headers + "\n")
        f.write("-" * 90 + "\n")
        print("\n" + headers)
        print("-" * 90)
        
        for name, data in results.items():
            if data["durations_ns"]:
                ms = [d / 1_000_000 for d in data["durations_ns"]]
                mean = statistics.mean(ms)
                ops_sec = 1000 / mean if mean > 0 else 0
                
                # Internal timings
                kem_avg = statistics.mean([it["kem_us"] for it in data["internals"]]) if data["internals"] else 0
                kdf_avg = statistics.mean([it["kdf_us"] for it in data["internals"]]) if data["internals"] else 0
                gaunt_avg = statistics.mean([it["gauntlet_us"] for it in data["internals"]]) if data["internals"] else 0
                
                line = f"{name:<10} | {data['status']:<7} | {mean:<10.3f} | {kem_avg:<10.0f} | {kdf_avg:<10.0f} | {gaunt_avg:<10.0f} | {ops_sec:<10.2f}\n"
                f.write(line)
                print(line.strip())
            else:
                line = f"{name:<10} | {data['status']:<7} | {'N/A':<10} | {'N/A':<10} | {'N/A':<10} | {'N/A':<10} | {'N/A'}\n"
                f.write(line)
                print(line.strip())

    log(f"\nAll results saved to {LOG_DIR}")
    log(f"Detailed Session Log: {SESSION_LOG_PATH}")
    log(f"Professional Performance Report: {report_path}")

if __name__ == "__main__":
    main()
