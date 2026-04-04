import subprocess
import json
import sys

try:
    print("Running KeyGen...")
    keygen = subprocess.check_output("python darkstar_crypt.py --v5 keygen", shell=True).decode()
    pk = keygen.split('\n')[0].split(': ')[1].strip()
    sk = keygen.split('\n')[1].split(': ')[1].strip()

    print("Encrypting with PK...")
    cmd = f'python darkstar_crypt.py --v5 encrypt "hello python test" {pk}'
    enc = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT).decode().strip()
    print("ENC result:", enc)
    r = json.loads(enc)
    enc_data = json.loads(r['encryptedData'])
    print(f"CT defined: {'ct' in enc_data}")
    print(f"Version: {enc_data.get('v')}")

    print("Decrypting with SK...")
    ds_raw = r['encryptedData']
    rk = r['reverseKey']
    dec = subprocess.check_output(['python', 'darkstar_crypt.py', '--v5', 'decrypt', ds_raw, rk, sk], stderr=subprocess.STDOUT).decode().strip()
    print(f"DEC: {dec}")

except subprocess.CalledProcessError as e:
    print(f"Error executing command: {e.cmd}")
    print(f"Return code: {e.returncode}")
    print(f"Output: {e.output.decode('utf-8', errors='ignore')}")
    sys.exit(1)
