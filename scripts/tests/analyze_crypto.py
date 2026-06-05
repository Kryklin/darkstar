import subprocess
import json
import os
import math
import sys
import secrets

def get_engine_cmd():
    rust_exe = os.path.join("rust", "target", "release", "d-asp.exe")
    if os.path.exists(rust_exe):
        return [rust_exe]
    return None

def shannon_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    entropy = 0
    for x in range(256):
        p_x = data.count(x) / len(data)
        if p_x > 0:
            entropy += - p_x * math.log2(p_x)
    return entropy

def chi_square(data: bytes) -> float:
    if not data:
        return 0.0
    expected = len(data) / 256.0
    chi2 = 0.0
    for x in range(256):
        observed = data.count(x)
        chi2 += ((observed - expected) ** 2) / expected
    return chi2

def serial_correlation(data: bytes) -> float:
    if len(data) < 2: return 0.0
    n = len(data) - 1
    sum_x = sum(data[:-1])
    sum_y = sum(data[1:])
    sum_xx = sum(x*x for x in data[:-1])
    sum_yy = sum(y*y for y in data[1:])
    sum_xy = sum(data[i]*data[i+1] for i in range(n))
    
    numerator = n * sum_xy - sum_x * sum_y
    denominator = math.sqrt((n * sum_xx - sum_x**2) * (n * sum_yy - sum_y**2))
    
    if denominator == 0: return 0.0
    return numerator / denominator

def monte_carlo_pi(data: bytes) -> float:
    points_in_circle = 0
    total_points = len(data) // 6
    if total_points == 0: return 0.0
    for i in range(total_points):
        x_bytes = data[i*6 : i*6 + 3]
        y_bytes = data[i*6 + 3 : i*6 + 6]
        x = int.from_bytes(x_bytes, byteorder='little') / 16777215.0
        y = int.from_bytes(y_bytes, byteorder='little') / 16777215.0
        if x*x + y*y <= 1.0:
            points_in_circle += 1
            
    return 4 * points_in_circle / total_points

def monobit_frequency(data: bytes) -> float:
    total_bits = len(data) * 8
    ones = sum(bin(b).count('1') for b in data)
    return ones / total_bits

def runs_test(data: bytes) -> float:
    n = len(data) * 8
    if n == 0: return 0.0
    
    bits = "".join(format(b, '08b') for b in data)
    actual_runs = 1
    for i in range(1, n):
        if bits[i] != bits[i-1]:
            actual_runs += 1
            
    expected_runs = (n / 2) + 1
    return actual_runs / expected_runs

def hex_to_bin(hex_str: str) -> str:
    return bin(int(hex_str, 16))[2:].zfill(len(hex_str) * 4)

def count_bit_flips(hex1: str, hex2: str) -> int:
    b1 = hex_to_bin(hex1)
    b2 = hex_to_bin(hex2)
    flips = sum(1 for bit1, bit2 in zip(b1, b2) if bit1 != bit2)
    return flips

def run_keygen(engine_cmd):
    res = subprocess.run(engine_cmd + ["keygen"], capture_output=True, text=True)
    pk, sk = "", ""
    for line in res.stdout.split('\n'):
        if line.startswith("PK:"): pk = line.split("PK:")[1].strip()
        if line.startswith("SK:"): sk = line.split("SK:")[1].strip()
    return pk, sk

def run_encrypt(engine_cmd, payload, pk, telemetry=False):
    tmp_file = os.path.abspath("tmp_analyze_payload.txt")
    with open(tmp_file, "w", encoding="utf-8") as f:
        f.write(payload)
        
    cmd = engine_cmd + ["encrypt", f"@{tmp_file}", pk]
    if telemetry:
        cmd.append("--telemetry")
        
    res = subprocess.run(cmd, capture_output=True, text=True)
    
    if os.path.exists(tmp_file):
        os.remove(tmp_file)
    try:
        lines = res.stdout.strip().split('\n')
        # find the json payload
        for line in reversed(lines):
            if line.startswith('{'):
                return json.loads(line)
        return json.loads(res.stdout.strip())
    except Exception as e:
        print("Error parsing encryption output:", e, res.stdout)
        sys.exit(1)

def main():
    engine_cmd = get_engine_cmd()
    if not engine_cmd:
        print(json.dumps({"error": "Rust engine not built."}))
        sys.exit(1)
        
    print("Generating keys...")
    pk, sk = run_keygen(engine_cmd)
    
    # 1. Entropy & Chi-Square Test
    print("Running Baseline Encryption...")
    base_payload = "A" * 102400 # 100KB of highly structured, low entropy data
    base_ct = run_encrypt(engine_cmd, base_payload, pk)
    ct_hex = base_ct["data"]
    ct_bytes = bytes.fromhex(ct_hex)
    
    entropy = shannon_entropy(ct_bytes)
    chi2 = chi_square(ct_bytes)
    serial_corr = serial_correlation(ct_bytes)
    pi_est = monte_carlo_pi(ct_bytes)
    monobit = monobit_frequency(ct_bytes)
    runs_ratio = runs_test(ct_bytes)
    
    # 2. Strict Avalanche Criterion (SAC) Test
    print("Running Avalanche Tests...")
    
    # We will flip 1 bit in the plaintext and observe changes in the ciphertext hex string
    payload_bytes = bytearray(b"CRYPTOGRAPHIC_AVALANCHE_TEST_PAYLOAD_1234567890")
    base_ct_sac = run_encrypt(engine_cmd, payload_bytes.decode('utf-8'), pk)["data"]
    
    flip_percentages = []
    
    # Do 20 rounds of random bit flips in the payload
    for _ in range(20):
        # flip a random bit in the payload
        mutated_payload = bytearray(payload_bytes)
        byte_idx = secrets.randbelow(len(mutated_payload))
        bit_idx = secrets.randbelow(8)
        mutated_payload[byte_idx] ^= (1 << bit_idx)
        
        mutated_ct_sac = run_encrypt(engine_cmd, mutated_payload.decode('utf-8', errors='ignore'), pk)["data"]
        
        # Ensure lengths are equal for comparison (they should be)
        if len(base_ct_sac) == len(mutated_ct_sac):
            flips = count_bit_flips(base_ct_sac, mutated_ct_sac)
            total_bits = len(base_ct_sac) * 4
            flip_percentages.append((flips / total_bits) * 100.0)

    avg_sac = sum(flip_percentages) / len(flip_percentages) if flip_percentages else 0.0

    # Cross-Key Avalanche
    pk2, _ = run_keygen(engine_cmd)
    cross_key_ct = run_encrypt(engine_cmd, base_payload, pk2)["data"]
    cross_key_diff = count_bit_flips(ct_hex, cross_key_ct)
    total_ck_bits = len(ct_hex) * 4
    cross_key_sac_percent = (cross_key_diff / total_ck_bits) * 100.0

    # 3. Constant-Time Verification
    print("Running Constant-Time Verification...")
    zeros_payload = "\x00" * (1024 * 1024)
    # Using 1MB of zeroes vs 1MB of repeating A's to ensure python string processing isn't the bottleneck
    ones_payload = "A" * (1024 * 1024) 
    
    timing_zeros = run_encrypt(engine_cmd, zeros_payload, pk, telemetry=True).get("timings", {})
    timing_ones = run_encrypt(engine_cmd, ones_payload, pk, telemetry=True).get("timings", {})
    
    z_time = timing_zeros.get("total_pipeline_us", 1)
    o_time = timing_ones.get("total_pipeline_us", 1)
    
    if z_time == 0: z_time = 1
    time_variance = abs(z_time - o_time) / z_time * 100.0

    result = {
        "entropy": round(entropy, 4),
        "chi_square": round(chi2, 2),
        "sac_percent": round(avg_sac, 2),
        "serial_correlation": round(serial_corr, 5),
        "monte_carlo_pi": round(pi_est, 5),
        "monobit": round(monobit, 4),
        "runs_test": round(runs_ratio, 4),
        "cross_key_sac": round(cross_key_sac_percent, 2),
        "time_variance": round(time_variance, 4)
    }
    
    with open('scripts/data/crypto_analysis.json', 'w') as f:
        json.dump(result, f)
        
    print("DONE")

if __name__ == "__main__":
    main()
