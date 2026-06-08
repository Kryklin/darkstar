"""
DARKSTAR - Secure Multi-Layered Encryption & Steganography Suite
Version: 3.0.0
Protocol: D-ASP (Professional Performance Benchmark)
Component: Cross-Language Interoperability Verifier (KAT)
Security: Grade-1024 (Kyber-Standard)

Professional Grade Diagnostic & Benchmarking Utility
Bit-Perfect Interoperability Verified
"""

import subprocess
import json
import os
import time
import statistics
import sys
import platform
import psutil
from datetime import datetime

# --- System Telemetry ---
def run_ps(cmd_body, timeout=8):
    """Helper to run PowerShell commands with a timeout."""
    cmd = ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd_body]
    try:
        return subprocess.check_output(cmd, timeout=timeout).decode().strip()
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return None

def get_system_info():
    info = {
        "os": f"{platform.system()} {platform.release()} ({platform.version()})",
        "cpu": platform.processor(),
        "arch": platform.machine(),
        "cores_phys": psutil.cpu_count(logical=False),
        "cores_log": psutil.cpu_count(logical=True),
        "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
        "ram_free_gb": round(psutil.virtual_memory().available / (1024**3), 2),
        "load_avg": [round(x, 2) for x in (psutil.getloadavg() if hasattr(psutil, "getloadavg") else [0,0,0])],
        "cpu_freq_nominal_mhz": "N/A",
        "l2_cache": "N/A",
        "l3_cache": "N/A",
        "disk_type": "N/A",
        "rust_v": "N/A"
    }
    
    # Try to get nominal frequency and cache via PowerShell
    if platform.system() == "Windows":
        # CPU Info via PowerShell
        cpu_ps = run_ps("Get-CimInstance Win32_Processor | Select-Object L2CacheSize, L3CacheSize, MaxClockSpeed | ConvertTo-Json")
        if cpu_ps:
            try:
                cpu_json = json.loads(cpu_ps)
                if isinstance(cpu_json, list): cpu_json = cpu_json[0]
                if "L2CacheSize" in cpu_json: info["l2_cache"] = f"{cpu_json['L2CacheSize']} KB"
                if "L3CacheSize" in cpu_json: info["l3_cache"] = f"{cpu_json['L3CacheSize']} KB"
                if "MaxClockSpeed" in cpu_json: info["cpu_freq_nominal_mhz"] = str(cpu_json['MaxClockSpeed'])
            except Exception as e: pass
        
        # Disk Info via PowerShell (Optimized CIM call)
        disk_ps = run_ps(r"Get-CimInstance -ClassName MSFT_PhysicalDisk -Namespace root\Microsoft\Windows\Storage | Select-Object FriendlyName, MediaType | ConvertTo-Json")
        if disk_ps:
            try:
                disk_json = json.loads(disk_ps)
                if isinstance(disk_json, list): disk_json = disk_json[0]
                info["disk_type"] = f"{disk_json.get('FriendlyName', 'Unknown')} ({disk_json.get('MediaType', 'Unknown')})"
            except Exception as e: pass
        
    try:
        rust_out = subprocess.check_output(["cargo", "--version"], timeout=5).decode().strip()
        info["rust_v"] = rust_out.split()[1]
    except Exception as e: pass
        
    return info

# --- Configuration & Paths ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SESSION_ID = datetime.now().strftime("%Y%m%d_%H%M%S")
ROOT_LOG_DIR = os.path.join(BASE_DIR, "logs")
LOG_DIR = os.path.join(ROOT_LOG_DIR, f"interop_{SESSION_ID}")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR, exist_ok=True)

# Engine Definitions
# Adjust binary names if they differ on your platform
ENGINES = {
    "Rust": {
        "cwd": os.path.join(BASE_DIR, "rust"),
        "cmd": [os.path.join(BASE_DIR, "rust", "target", "release", "d-asp.exe")],
        "type": "native"
    },
    "C": {
        "cwd": os.path.join(BASE_DIR, "c"),
        "cmd": [os.path.join(BASE_DIR, "c", "dasp.exe")],
        "type": "native"
    },
    "CUDA": {
        "cwd": os.path.join(BASE_DIR, "cuda"),
        "cmd": [os.path.join(BASE_DIR, "cuda", "d-asp_cuda.exe")],
        "type": "native"
    }
}

SESSION_LOG_PATH = os.path.join(LOG_DIR, "session.log")

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
                except Exception: pass
        
        # If not in stderr, check if stdout is JSON containing it (Encrypt pattern)
        if not internal_timings:
            try:
                out_json = json.loads(res.stdout)
                if "timings" in out_json:
                    internal_timings = out_json["timings"]
            except Exception: pass

        return res.stdout.strip(), end - start, internal_timings
    except subprocess.CalledProcessError as e:
        log(f"ERROR: Command failed: {' '.join(cmd)}\nStdout: {e.stdout}\nStderr: {e.stderr}")
        raise

def benchmark_engine(name, encrypted_payload, sk_hex, hwid, use_docker=False):
    engine = ENGINES[name]
    safe_name = name.replace('#', 'sharp')
    if use_docker:
        filename = f"interop_{safe_name}.json"
        cmd = engine["cmd"] + ["decrypt", f"@/data/{filename}", sk_hex, "--hwid", hwid, "--telemetry"]
        cwd = BASE_DIR
        with open(os.path.join(cwd, filename), "w") as f:
            f.write(encrypted_payload)
    else:
        filename = f"interop_{safe_name}.json"
        cmd = engine["cmd"] + ["decrypt", f"@{filename}", sk_hex, "--hwid", hwid, "--telemetry"]
        cwd = engine["cwd"]
        with open(os.path.join(cwd, filename), "w") as f:
            f.write(encrypted_payload)
        
    times = []
    internal_metrics = []
    output = ""
    # Warmup
    run_cmd(cmd, cwd)
    
    # Benchmark Rounds
    ROUNDS = 20
    for _ in range(ROUNDS):
        out, duration, it = run_cmd(cmd, cwd)
        times.append(duration)
        if it:
            internal_metrics.append(it)
        output = out
        
    try:
        parsed = json.loads(output)
        if "data" in parsed:
            output = parsed["data"]
    except:
        pass
        
    return output, times, internal_metrics

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--docker", action="store_true", help="Run benchmark using Docker containers")
    args, _ = parser.parse_known_args()

    use_docker = args.docker
    if use_docker:
        for name in ENGINES:
            image_name = f"darkstar-dasp-{name.lower().replace('#', 'sharp')}"
            mount_arg = f"{BASE_DIR}:/data"
            if name == "CUDA":
                ENGINES[name]["cmd"] = ["docker", "run", "--rm", "--gpus", "all", "-v", mount_arg, image_name]
            else:
                ENGINES[name]["cmd"] = ["docker", "run", "--rm", "-v", mount_arg, image_name]

    if not use_docker:
        for engine_name, engine in ENGINES.items():
            cmd_bin = engine["cmd"][0]
            if os.path.isabs(cmd_bin) and not os.path.exists(cmd_bin):
                print(f"\n[!] ERROR: Missing binary for {engine_name} engine -> {cmd_bin}")
                print("Please build the native engines first using the 'Build Native Crypto Engines' option in the CLI menu.\n")
                sys.exit(1)

    sys_info = get_system_info()
    log(f"--- D-ASP Professional Performance Benchmark (Session: {SESSION_ID}) ---")
    log("System Telemetry Captured.")
    if use_docker:
        log("Mode: DOCKER CONTAINERS")
    
    # Get current frequency start
    freq_start = psutil.cpu_freq().current
    
    # 1. Setup Test Data (using Rust as reference for keygen/encrypt)
    log("Step 1: Generating standard ML-KEM-1024 test vector...")
    keygen_cwd = BASE_DIR if use_docker else ENGINES["Rust"]["cwd"]
    keygen_out, _, _ = run_cmd(ENGINES["Rust"]["cmd"] + ["keygen"], keygen_cwd)
    # Rust keygen output format: "PK: <hex>\nSK: <hex>"
    lines = keygen_out.splitlines()
    pk = lines[0].split(": ")[1]
    sk = lines[1].split(": ")[1]
    
    payload = "Professional Grade Benchmark Payload: 0123456789ABCDEF0123456789ABCDEF" * 1024
    hwid = "11223344556677889900AABBCCDDEEFF11223344556677889900AABBCCDDEEFF"
    
    log(f"Payload: '{payload[:64]}... ({len(payload)} bytes)'")
    log(f"Identity Binding (HWID): {hwid[:16]}...")

    # 2. Encrypt using reference (Rust)
    log("Step 2: Creating reference ciphertext (Rust)...")
    enc_cwd = BASE_DIR if use_docker else ENGINES["Rust"]["cwd"]
    
    payload_file = os.path.join(enc_cwd, "payload.txt")
    with open(payload_file, "w") as f:
        f.write(payload)
        
    payload_arg = "@/data/payload.txt" if use_docker else "@payload.txt"
    enc_json, _, _ = run_cmd(ENGINES["Rust"]["cmd"] + ["encrypt", payload_arg, pk, "--hwid", hwid, "--telemetry"], enc_cwd)
    
    # 3. Cross-Platform Benchmark
    log("\nStep 3: Executing Cross-Platform Benchmark (20 rounds each in parallel)...")
    results = {}
    
    import concurrent.futures
    
    def run_for_engine(name):
        try:
            log(f"Benchmarking {name} (Started)...", to_console=True)
            decrypted, durations, internals = benchmark_engine(name, enc_json, sk, hwid, use_docker=use_docker)
            
            # Verify Parity
            if decrypted.strip() == payload:
                status = "PASSED"
            else:
                status = f"FAILED (Output: '{decrypted}')"
                
            # Save raw output log
            raw_log_path = os.path.join(LOG_DIR, f"engine_raw_{name}.json")
            with open(raw_log_path, "w") as f:
                f.write(decrypted)
                
            log(f"Benchmarking {name} (Finished)...", to_console=True)
            return name, {
                "status": status,
                "durations_ns": durations,
                "internals": internals,
                "output": decrypted
            }
        except Exception as e:
            log(f"Critical error benchmarking {name}: {e}")
            return name, {"status": f"ERROR: {e}", "durations_ns": [], "internals": []}

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(run_for_engine, name): name for name in ENGINES}
        for future in concurrent.futures.as_completed(futures):
            name, data = future.result()
            results[name] = data

    # Get current frequency end
    freq_end = psutil.cpu_freq().current
    avg_freq_mhz = (freq_start + freq_end) / 2
    avg_freq_ghz = avg_freq_mhz / 1000.0

    # 4. Generate Performance Report
    report_path = os.path.join(LOG_DIR, "performance_report.txt")
    with open(report_path, "w") as f:
        f.write(f"D-ASP PROFESSIONAL PERFORMANCE REPORT\n")
        f.write(f"Session: {SESSION_ID}\n")
        f.write(f"Timestamp: {datetime.now().isoformat()}\n")
        f.write(f"Protocol: Darkstar ARX Substitution & Permutation (D-ASP)\n")
        f.write(f"Anchor: ML-KEM-1024\n\n")
        
        f.write(f"SYSTEM TELEMETRY\n")
        f.write(f"{'-'*60}\n")
        f.write(f"OS:        {sys_info['os']}\n")
        f.write(f"CPU:       {sys_info['cpu']}\n")
        f.write(f"Arch:      {sys_info['arch']}\n")
        f.write(f"Cores:     {sys_info['cores_phys']} Phys / {sys_info['cores_log']} Log\n")
        f.write(f"RAM:       {sys_info['ram_total_gb']} GB ({sys_info['ram_free_gb']} GB Free)\n")
        f.write(f"L2/L3:     {sys_info['l2_cache']} / {sys_info['l3_cache']}\n")
        f.write(f"Disk:      {sys_info['disk_type']}\n")
        f.write(f"Load Avg:  {sys_info['load_avg']}\n")
        f.write(f"Freq (Nominal/Current): {sys_info['cpu_freq_nominal_mhz']} / {avg_freq_mhz:.0f} MHz\n")
        f.write(f"{'-'*60}\n")
        f.write(f"RUNTIMES\n")
        f.write(f"Rustc:     {sys_info['rust_v']}\n")
        f.write(f"{'-'*60}\n\n")
        
        headers = f"{'Engine':<10} | {'Status':<7} | {'Total Time':<12} | {'Casca Time':<12} | {'Casca CPB':<10} | {'Total CPB':<10} | {'Ops/sec'}"
        f.write(headers + "\n")
        f.write("-" * 100 + "\n")
        print("\n" + headers)
        print("-" * 100)
        
        for name, data in results.items():
            if data["durations_ns"]:
                ms = [d / 1_000_000 for d in data["durations_ns"]]
                mean_ms = statistics.mean(ms)
                
                # Internal timings
                try:
                    casca_avg_us = statistics.mean([it["cascade_us"] for it in data["internals"]]) if data["internals"] else 0
                    total_avg_us = statistics.mean([it.get("total_us", it["cascade_us"]) for it in data["internals"]]) if data["internals"] else 0
                except KeyError as e:
                    print(f"CRITICAL ERROR in {name}: internals missing {e}. Internals: {data['internals']}")
                    raise
                
                # Calculate True Ops/sec based on Casca Time
                # casca_avg_us is in microseconds, so ops/sec = 1_000_000 / casca_avg_us
                ops_sec = 1_000_000 / casca_avg_us if casca_avg_us > 0 else 0
                
                # CPB Calculation (for actual payload size)
                # CPB = (ns * freq_ghz) / len
                casca_cpb = (casca_avg_us * 1000 * avg_freq_ghz) / len(payload)
                total_cpb = (total_avg_us * 1000 * avg_freq_ghz) / len(payload)
                
                # Format Time dynamically based on true internal execution time (no Docker overhead)
                true_total_ms = total_avg_us / 1000.0
                mean_time_str = f"{total_avg_us:.1f} us" if total_avg_us < 1000.0 else f"{true_total_ms:.3f} ms"
                casca_time_str = f"{casca_avg_us:.3f} us" if casca_avg_us < 10.0 else (f"{casca_avg_us:.0f} us" if casca_avg_us < 1000.0 else f"{casca_avg_us / 1000.0:.3f} ms")

                line = f"{name:<10} | {data['status']:<7} | {mean_time_str:<12} | {casca_time_str:<12} | {casca_cpb:<10.2f} | {total_cpb:<10.2f} | {ops_sec:<10.2f}\n"
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
