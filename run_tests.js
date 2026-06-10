import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '.');

const ENGINES = {
  Rust: {
    cwd: path.resolve(BASE_DIR, 'rust'),
    cmd: path.resolve(BASE_DIR, 'rust/target/release/d-spna-512.exe'),
  },
  C: {
    cwd: path.resolve(BASE_DIR, 'c'),
    cmd: path.resolve(BASE_DIR, 'c/d-spna-512.exe'),
  },
  CUDA: {
    cwd: path.resolve(BASE_DIR, 'cuda'),
    cmd: path.resolve(BASE_DIR, 'cuda/d-spna-512_cuda.exe'),
  },
};

const ROUNDS = 50;

async function main() {
  console.log("Starting Interop Benchmark Suite...");
  
  const payload = 'Professional Grade Benchmark Payload: 0123456789ABCDEF0123456789ABCDEF'.repeat(1024);
  const hwid = '11223344556677889900AABBCCDDEEFF11223344556677889900AABBCCDDEEFF';
  const freq_ghz = 3.5;

  try {
    const keygenRes = execSync(`"${ENGINES.Rust.cmd}" keygen`, { cwd: ENGINES.Rust.cwd }).toString();
    const pkMatch = keygenRes.match(/PK:\s*([0-9a-fA-F]+)/);
    const skMatch = keygenRes.match(/SK:\s*([0-9a-fA-F]+)/);
    if (!pkMatch || !skMatch) throw new Error("Keygen failed");
    const pk = pkMatch[1];
    const sk = skMatch[1];



    for (const [name, engine] of Object.entries(ENGINES)) {
      console.log(`\nTesting ${name}...`);
      let casca_us_list = [];
      let lastOutput = '';
      let expectedLastPayload = '';
      
      await new Promise((resolve, reject) => {
        const child = spawn(engine.cmd, ['stream-decrypt', sk, '--hwid', hwid, '--telemetry'], { cwd: engine.cwd });
        
        const rl = readline.createInterface({
          input: child.stdout,
          terminal: false
        });

        rl.on('line', (line) => {
          if (!line.trim()) return;
          try {
            const out_json = JSON.parse(line);
            if (out_json.timings) casca_us_list.push(out_json.timings.cascade_us || 0);
            lastOutput = out_json.data || line;
          } catch (e) {
            lastOutput = line;
          }
        });

        child.stderr.on('data', (data) => {
          console.error(`[${name} STDERR] ${data.toString().trim()}`);
        });
        
        child.on('close', (code) => {
          if (code !== 0) {
            console.log(`[${name}] Exited with code ${code}`);
          }
          
          let status = 'PASS';
          if (lastOutput !== expectedLastPayload) {
            status = 'MISMATCH';
            console.log(`[${name}] Expected payload length: ${expectedLastPayload.length}`);
            console.log(`[${name}] Actual output length: ${lastOutput.length}`);
            console.log(`[${name}] Actual output starts with: ${lastOutput.substring(0, 100)}`);
          }
          
          const casca_us = casca_us_list.length ? casca_us_list.reduce((a, b) => a + b, 0) / casca_us_list.length : 0;
          const ops_sec = casca_us > 0 ? 1_000_000 / casca_us : 0;
          const casca_cpb = (casca_us * 1000 * freq_ghz) / payload.length;
          const throughput_mbps = casca_us > 0 ? payload.length / 1048576 / (casca_us / 1000000) : 0;

          console.log(`==================================================`);
          console.log(`[${name}] VALIDATION: ${status}`);
          console.log(`[${name}] CASCADE SPEED: ${casca_us.toFixed(2)} us`);
          console.log(`[${name}] CYCLES/BYTE: ${casca_cpb.toFixed(2)} CPB`);
          console.log(`[${name}] OPS/SEC: ${ops_sec.toLocaleString('en-US', {maximumFractionDigits: 0})}`);
          console.log(`[${name}] THROUGHPUT: ${throughput_mbps.toFixed(2)} MB/s`);
          console.log(`==================================================`);
          resolve(true);
        });

        for (let i = 0; i < ROUNDS; i++) {
          const varyingPayload = payload.substring(0, payload.length - 10) + i.toString().padStart(10, '0');
          const payloadFile = path.join(ENGINES.Rust.cwd, 'payload.txt');
          fs.writeFileSync(payloadFile, varyingPayload, 'utf-8');
          const encRes = execSync(`"${ENGINES.Rust.cmd}" encrypt @payload.txt ${pk} --hwid ${hwid} --telemetry`, {
            cwd: ENGINES.Rust.cwd
          }).toString();
          let encJson = JSON.parse(encRes.trim());
          if (i === ROUNDS - 1) {
            expectedLastPayload = varyingPayload;
          }
          child.stdin.write(JSON.stringify(encJson) + '\n');
        }
        child.stdin.end();
      });
    }
    
    console.log("\nALL INTEROP TESTS COMPLETED.");
  } catch(e) {
    console.error("Interop failed", e);
  }
}

main();
