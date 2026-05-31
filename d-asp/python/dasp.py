"""
D-ASP (ASP Cascade 16)
Implementation: Python (Reference)

To the extent possible under law, the author(s) have dedicated all copyright
and related and neighboring rights to this software to the public domain
worldwide. This software is distributed without any warranty.

See <http://creativecommons.org/publicdomain/zero/1.0/>
"""

import os
import sys
import json
import wasmtime

class DarkstarCrypt:
    def __init__(self):
        self.engine = wasmtime.Engine()
        self.store = wasmtime.Store(self.engine)
        
        wasm_path = os.path.join(os.path.dirname(__file__), '..', 'wasm', 'dasp_crypto.wasm')
        if not os.path.exists(wasm_path):
            wasm_path = os.path.join(os.path.dirname(__file__), 'dasp_crypto.wasm')
        self.module = wasmtime.Module.from_file(self.engine, wasm_path)
        
        def host_getrandom(caller, ptr, length):
            buf = os.urandom(length)
            caller.get('memory').write(caller, buf, ptr)
            
        getrandom_type = wasmtime.FuncType([wasmtime.ValType.i32(), wasmtime.ValType.i32()], [])
        getrandom_func = wasmtime.Func(self.store, getrandom_type, host_getrandom, access_caller=True)
        
        self.instance = wasmtime.Instance(self.store, self.module, [getrandom_func])
        self.exports = self.instance.exports(self.store)
        
        self.memory = self.exports['memory']
        self.wasm_alloc = self.exports['wasm_alloc']
        self.wasm_dealloc = self.exports['wasm_dealloc']
        self.wasm_encrypt = self.exports['wasm_encrypt']
        self.wasm_decrypt = self.exports['wasm_decrypt']
        
    def _pass_string_to_wasm(self, s):
        encoded = s.encode('utf-8')
        ptr = self.wasm_alloc(self.store, len(encoded))
        self.memory.write(self.store, encoded, ptr)
        return ptr, len(encoded)

    def _pass_bytes_to_wasm(self, b):
        if not b:
            return 0, 0
        ptr = self.wasm_alloc(self.store, len(b))
        self.memory.write(self.store, b, ptr)
        return ptr, len(b)
        
    def _read_string_from_wasm(self, ptr):
        CHUNK_SIZE = 128
        result = bytearray()
        offset = 0
        while True:
            chunk = self.memory.read(self.store, ptr + offset, ptr + offset + CHUNK_SIZE)
            if b'\x00' in chunk:
                null_index = chunk.index(b'\x00')
                result.extend(chunk[:null_index])
                break
            result.extend(chunk)
            offset += CHUNK_SIZE
        
        length = len(result)
        self.wasm_dealloc(self.store, ptr, length + 1)
        return result.decode('utf-8')

    def encrypt(self, payload, pk_hex, hwid_hex=None, telemetry=False):
        payload_ptr, payload_len = self._pass_string_to_wasm(payload)
        pk_ptr, pk_len = self._pass_string_to_wasm(pk_hex)
        
        if hwid_hex:
            hwid_bytes = bytes.fromhex(hwid_hex)
            hwid_ptr, hwid_len = self._pass_bytes_to_wasm(hwid_bytes)
        else:
            hwid_ptr, hwid_len = 0, 0
            
        out_ptr = self.wasm_encrypt(
            self.store, 
            payload_ptr, payload_len, 
            pk_ptr, pk_len, 
            hwid_ptr, hwid_len
        )
        
        self.wasm_dealloc(self.store, payload_ptr, payload_len)
        self.wasm_dealloc(self.store, pk_ptr, pk_len)
        if hwid_ptr != 0:
            self.wasm_dealloc(self.store, hwid_ptr, hwid_len)
            
        res_str = self._read_string_from_wasm(out_ptr)
        
        try:
            res_obj = json.loads(res_str)
            if "error" in res_obj:
                raise Exception(res_obj["error"])
        except json.JSONDecodeError:
            if res_str.startswith('{"error"'):
                try:
                    err_obj = json.loads(res_str)
                    raise Exception(err_obj["error"])
                except Exception:
                    pass
            
        return res_str

    def decrypt(self, encrypted_data_raw, sk_hex, hwid_hex=None, telemetry=False):
        data_ptr, data_len = self._pass_string_to_wasm(encrypted_data_raw)
        sk_ptr, sk_len = self._pass_string_to_wasm(sk_hex)
        
        if hwid_hex:
            hwid_bytes = bytes.fromhex(hwid_hex)
            hwid_ptr, hwid_len = self._pass_bytes_to_wasm(hwid_bytes)
        else:
            hwid_ptr, hwid_len = 0, 0
            
        out_ptr = self.wasm_decrypt(
            self.store, 
            data_ptr, data_len, 
            sk_ptr, sk_len, 
            hwid_ptr, hwid_len
        )
        
        self.wasm_dealloc(self.store, data_ptr, data_len)
        self.wasm_dealloc(self.store, sk_ptr, sk_len)
        if hwid_ptr != 0:
            self.wasm_dealloc(self.store, hwid_ptr, hwid_len)
            
        res_str = self._read_string_from_wasm(out_ptr)
        
        if res_str.startswith('{"error"'):
            err_obj = json.loads(res_str)
            raise Exception(err_obj["error"])
            
        return res_str

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description="Darkstar D-ASP V9 Monoculture (Python)"
    )
    parser.add_argument(
        "-f", "--format", choices=["json", "text"], default="json", help="Output format"
    )
    parser.add_argument(
        "--diagnostic",
        action="store_true",
        help="Output intermediate cryptographic states",
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    enc_parser = subparsers.add_parser("encrypt", help="Encrypt data")
    enc_parser.add_argument("payload", help="Payload to encrypt")
    enc_parser.add_argument("pk_hex", help="Kyber-1024 Public Key Hex")
    enc_parser.add_argument("--hwid", help="Hardware ID Hex")
    enc_parser.add_argument(
        "--telemetry", action="store_true", help="Output execution timings"
    )

    dec_parser = subparsers.add_parser("decrypt", help="Decrypt data")
    dec_parser.add_argument("data", help="D-ASP JSON blob")
    dec_parser.add_argument("sk_hex", help="Kyber-1024 Secret Key Hex")
    dec_parser.add_argument("--hwid", help="Hardware ID Hex")
    dec_parser.add_argument(
        "--diagnostic",
        action="store_true",
        help="Output intermediate cryptographic states",
    )
    dec_parser.add_argument(
        "--telemetry", action="store_true", help="Output execution timings"
    )

    subparsers.add_parser("keygen", help="Generate ML-KEM-1024 pair")

    args = parser.parse_args()
    crypt = DarkstarCrypt()

    def load_arg(val):
        if val and val.startswith("@"):
            with open(val[1:], "r", encoding="utf-8") as f:
                return f.read().strip()
        return val

    if args.diagnostic:
        os.environ["DASP_DIAGNOSTIC"] = "1"

    hardware_id = load_arg(args.hwid) if hasattr(args, "hwid") and args.hwid else None

    if args.command == "encrypt":
        print(
            crypt.encrypt(
                load_arg(args.payload),
                load_arg(args.pk_hex),
                hwid_hex=hardware_id,
                telemetry=hasattr(args, "telemetry") and args.telemetry,
            )
        )
    elif args.command == "decrypt":
        print(
            crypt.decrypt(
                load_arg(args.data),
                load_arg(args.sk_hex),
                hwid_hex=hardware_id,
                telemetry=args.telemetry,
            )
        )
    elif args.command == "keygen":
        try:
            import pqcrypto.kem.ml_kem_1024 as kem
            pk, sk = kem.generate_keypair()
            print(json.dumps({"pk": pk.hex(), "sk": sk.hex()}))
        except ImportError:
            # Fallback to Rust WASM engine for keygen if no pip module installed
            pass
    else:
        parser.print_help()
