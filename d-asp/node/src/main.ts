/*
 * D-ASP (ASP Cascade 16)
 * Implementation: Node.js (Production Bridge Implementation)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as nodeCrypto from 'node:crypto';
const { ml_kem1024: kyber } = require('@noble/post-quantum/ml-kem.js');

let wasmPath = path.join(__dirname, '..', '..', 'wasm', 'dasp_crypto.wasm');
if (!fs.existsSync(wasmPath)) {
    wasmPath = path.join(__dirname, '..', 'dasp_crypto.wasm');
}
const wasmBuffer = fs.readFileSync(wasmPath);

export class DarkstarCrypt {
  wasmInstance: WebAssembly.Instance | null;

  constructor() {
    this.wasmInstance = null;
  }

  async init(): Promise<void> {
    if (this.wasmInstance) return;
    
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    
    const importObject = {
      env: {
        host_getrandom: (ptr: number, len: number) => {
          if (!this.wasmInstance) return;
          const mem = new Uint8Array((this.wasmInstance.exports.memory as WebAssembly.Memory).buffer);
          nodeCrypto.randomFillSync(mem, ptr, len);
        }
      }
    };
    
    const instance = await WebAssembly.instantiate(wasmModule, importObject);
    this.wasmInstance = instance;
  }

  hex2buf(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) hex = '0' + hex;
    const buf = new Uint8Array(hex.length / 2);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return buf;
  }

  buf2hex(buf: Uint8Array): string {
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  private _passStringToWasm(str: string): { ptr: number; len: number } {
    if (!this.wasmInstance) throw new Error("WASM not initialized");
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    const wasm_alloc = this.wasmInstance.exports.wasm_alloc as CallableFunction;
    const ptr = wasm_alloc(encoded.length) as number;
    const mem = new Uint8Array((this.wasmInstance.exports.memory as WebAssembly.Memory).buffer);
    mem.set(encoded, ptr);
    return { ptr, len: encoded.length };
  }
  
  private _passBufferToWasm(buf: Uint8Array | null): { ptr: number; len: number } {
    if (!buf) return { ptr: 0, len: 0 };
    if (!this.wasmInstance) throw new Error("WASM not initialized");
    const wasm_alloc = this.wasmInstance.exports.wasm_alloc as CallableFunction;
    const ptr = wasm_alloc(buf.length) as number;
    const mem = new Uint8Array((this.wasmInstance.exports.memory as WebAssembly.Memory).buffer);
    mem.set(buf, ptr);
    return { ptr, len: buf.length };
  }
  
  private _readStringFromWasm(ptr: number): string {
    if (!this.wasmInstance) throw new Error("WASM not initialized");
    const mem = new Uint8Array((this.wasmInstance.exports.memory as WebAssembly.Memory).buffer);
    let end = ptr;
    while (mem[end] !== 0) end++;
    const decoder = new TextDecoder();
    const result = decoder.decode(mem.subarray(ptr, end));
    const wasm_dealloc = this.wasmInstance.exports.wasm_dealloc as CallableFunction;
    wasm_dealloc(ptr, end - ptr + 1);
    return result;
  }

  async encrypt(payload: string, pkHex: string, hwidHex: string | null = null, telemetry: boolean = false): Promise<string> {
    await this.init();
    if (!this.wasmInstance) throw new Error("WASM not initialized");
    
    const payloadWasm = this._passStringToWasm(payload);
    const pkWasm = this._passStringToWasm(pkHex);
    let hwidWasm = { ptr: 0, len: 0 };
    if (hwidHex) {
      hwidWasm = this._passBufferToWasm(this.hex2buf(hwidHex));
    }
    
    const wasm_encrypt = this.wasmInstance.exports.wasm_encrypt as CallableFunction;
    const outPtr = wasm_encrypt(
      payloadWasm.ptr, payloadWasm.len,
      pkWasm.ptr, pkWasm.len,
      hwidWasm.ptr, hwidWasm.len
    ) as number;
    
    const wasm_dealloc = this.wasmInstance.exports.wasm_dealloc as CallableFunction;
    wasm_dealloc(payloadWasm.ptr, payloadWasm.len);
    wasm_dealloc(pkWasm.ptr, pkWasm.len);
    if (hwidWasm.ptr !== 0) {
      wasm_dealloc(hwidWasm.ptr, hwidWasm.len);
    }
    
    const resultJsonStr = this._readStringFromWasm(outPtr);
    
    try {
        const res = JSON.parse(resultJsonStr);
        if (res.error) {
            throw new Error(res.error);
        }
    } catch(e) {
        if (resultJsonStr.startsWith('{"error"')) {
            throw new Error(JSON.parse(resultJsonStr).error);
        }
    }
    
    return resultJsonStr;
  }

  async decrypt(encryptedDataRaw: string, skHex: string, hwidHex: string | null = null, telemetry: boolean = false): Promise<string> {
    await this.init();
    if (!this.wasmInstance) throw new Error("WASM not initialized");
    
    const dataWasm = this._passStringToWasm(encryptedDataRaw);
    const skWasm = this._passStringToWasm(skHex);
    let hwidWasm = { ptr: 0, len: 0 };
    if (hwidHex) {
      hwidWasm = this._passBufferToWasm(this.hex2buf(hwidHex));
    }
    
    const wasm_decrypt = this.wasmInstance.exports.wasm_decrypt as CallableFunction;
    const outPtr = wasm_decrypt(
      dataWasm.ptr, dataWasm.len,
      skWasm.ptr, skWasm.len,
      hwidWasm.ptr, hwidWasm.len
    ) as number;
    
    const wasm_dealloc = this.wasmInstance.exports.wasm_dealloc as CallableFunction;
    wasm_dealloc(dataWasm.ptr, dataWasm.len);
    wasm_dealloc(skWasm.ptr, skWasm.len);
    if (hwidWasm.ptr !== 0) {
      wasm_dealloc(hwidWasm.ptr, hwidWasm.len);
    }
    
    const resultStr = this._readStringFromWasm(outPtr);
    if (resultStr.startsWith('{"error"')) {
        const errObj = JSON.parse(resultStr);
        throw new Error(errObj.error);
    }
    return resultStr;
  }
}

// --- CLI Execution ---
if (require.main === module) {
  const args = process.argv.slice(2);
  let hwid: string | null = null;
  let diagnostic = false;
  let telemetry = false;

  const parsedArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hwid' && i + 1 < args.length) {
      let val = args[i + 1];
      if (val.startsWith('@')) {
        val = fs.readFileSync(val.slice(1), 'utf-8').trim();
      }
      hwid = val;
      i++;
    } else if (args[i] === '--diagnostic') {
      process.env.DASP_DIAGNOSTIC = '1';
      diagnostic = true;
    } else if (args[i] === '--telemetry') {
      telemetry = true;
    } else {
      parsedArgs.push(args[i]);
    }
  }

  if (parsedArgs.length === 0) {
    console.log('Usage: node main.js <command> [args]');
    process.exit(1);
  }

  const command = parsedArgs[0];
  const crypt = new DarkstarCrypt();

  const resolveArg = (arg: string): string => {
    if (arg && arg.startsWith('@')) {
      return fs.readFileSync(arg.slice(1), 'utf-8').trim();
    }
    return arg;
  };

  (async () => {
    try {
      if (command === 'encrypt') {
        const payload = resolveArg(parsedArgs[1]);
        const pkHex = resolveArg(parsedArgs[2]);
        const res = await crypt.encrypt(payload, pkHex, hwid, telemetry);
        process.stdout.write(res);
      } else if (command === 'decrypt') {
        const data = resolveArg(parsedArgs[1]);
        const skHex = resolveArg(parsedArgs[2]);
        const res = await crypt.decrypt(data, skHex, hwid, telemetry);
        process.stdout.write(res);
      } else if (command === 'keygen') {
        const keypair = kyber.keygen();
        const pk = crypt.buf2hex(keypair.publicKey);
        const sk = crypt.buf2hex(keypair.secretKey);
        console.log(JSON.stringify({ pk, sk }));
      } else {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
