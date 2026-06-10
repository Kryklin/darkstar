import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import { performance } from 'perf_hooks';
import readline from 'readline';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../../../');

const ENGINES = {
  Rust: {
    cwd: path.resolve(__dirname, '../../../rust'),
    cmd: [path.resolve(__dirname, '../../../rust/target/release/d-spna-512.exe')],
  },
  C: {
    cwd: path.resolve(__dirname, '../../../c'),
    cmd: [path.resolve(__dirname, '../../../c/d-spna-512.exe')],
  },
  CUDA: {
    cwd: path.resolve(__dirname, '../../../cuda'),
    cmd: [path.resolve(__dirname, '../../../cuda/d-spna-512_cuda.exe')],
  },
};

export type InteropResult = {
  engine: string;
  status: string;
  casca_us: number;
  casca_cpb: number;
  ops_sec: number;
  throughput_mbps: number;
};

async function runCmd(cmd: string[], cwd: string): Promise<{ stdout: string; duration_ns: number; internal_timings: any }> {
  const start = performance.now();
  const res = await execa(cmd[0], cmd.slice(1), { cwd, reject: false });
  const end = performance.now();

  if (res.exitCode !== 0) {
    throw new Error(`Command failed: ${cmd.join(' ')}\n${res.stderr}\n${res.stdout}`);
  }

  let internal_timings = null;
  const lines = res.stderr.split('\n');
  for (const line of lines) {
    if (line.includes('"timings":')) {
      try {
        internal_timings = JSON.parse(line).timings;
      } catch (e) {}
    }
  }

  if (!internal_timings) {
    try {
      const out_json = JSON.parse(res.stdout);
      if (out_json.timings) {
        internal_timings = out_json.timings;
      }
    } catch (e) {}
  }

  return { stdout: res.stdout.trim(), duration_ns: (end - start) * 1_000_000, internal_timings };
}

export async function runInteropBenchmark(
  onProgress: (engine: string, progress: number, result?: InteropResult, current?: number, total?: number) => void,
  ROUNDS: number = 100,
  useDocker: boolean = false,
): Promise<InteropResult[]> {
  onProgress('Setup', 0);

  const payload = 'Professional Grade Benchmark Payload: 0123456789ABCDEF0123456789ABCDEF'.repeat(1024);
  const hwid = '11223344556677889900AABBCCDDEEFF11223344556677889900AABBCCDDEEFF';
  const freq_ghz = 3.5; // Estimated nominal freq

  // Keygen (Rust)
  const keygenRes = await runCmd([...ENGINES.Rust.cmd, 'keygen'], ENGINES.Rust.cwd);
  if (!keygenRes.stdout.includes('PK:')) {
    throw new Error('Keygen output invalid: ' + keygenRes.stdout);
  }
  const pkMatch = keygenRes.stdout.match(/PK:\s*([0-9a-fA-F]+)/);
  const skMatch = keygenRes.stdout.match(/SK:\s*([0-9a-fA-F]+)/);
  const pk = pkMatch ? pkMatch[1] : '';
  const sk = skMatch ? skMatch[1] : '';

  // Encrypt (Rust)
  const payloadFile = path.join(ENGINES.Rust.cwd, 'payload.txt');
  await fs.writeFile(payloadFile, payload, 'utf-8');

  const rustCmd = useDocker ? ['docker', 'run', '-i', '--rm', '-v', `${BASE_DIR}:/data`, 'darkstar-dasp-rust'] : ENGINES.Rust.cmd;
  const payloadArg = useDocker ? '@/data/rust/payload.txt' : `@${payloadFile}`;

  const encRes = await runCmd([...rustCmd, 'encrypt', payloadArg, pk, '--hwid', hwid, '--telemetry'], ENGINES.Rust.cwd);
  let encPayload = JSON.stringify(JSON.parse(encRes.stdout));

  const results: InteropResult[] = [];

  await Promise.all(
    Object.entries(ENGINES).map(async ([name, engine]) => {
      onProgress(name, 0);

      let cmd: string[];
      if (useDocker) {
        const imageName = `darkstar-dasp-${name.toLowerCase()}`;
        if (name === 'CUDA') {
          cmd = ['docker', 'run', '-i', '--rm', '--gpus', 'all', imageName, 'stream-decrypt', sk, '--hwid', hwid, '--telemetry'];
        } else {
          cmd = ['docker', 'run', '-i', '--rm', imageName, 'stream-decrypt', sk, '--hwid', hwid, '--telemetry'];
        }
      } else {
        cmd = [...engine.cmd, 'stream-decrypt', sk, '--hwid', hwid, '--telemetry'];
      }

      // Warmup process is not needed as much since we spawn once and stream, but we keep the engine map.
      const casca_us_list: number[] = [];
      let lastOutput = '';
      let status = 'PASS';
      let lineCount = 0;

      const child = execa(cmd[0], cmd.slice(1), { cwd: useDocker ? BASE_DIR : engine.cwd, reject: false, buffer: false });

      const rl = readline.createInterface({ input: child.stdout! });

      rl.on('line', (line) => {
        lineCount++;
        try {
          const out_json = JSON.parse(line);
          if (out_json.timings) {
            casca_us_list.push(out_json.timings.cascade_us || 0);
          }
          if (lineCount === ROUNDS) {
            lastOutput = out_json.data || line;
          }
        } catch (e) {
          if (lineCount === ROUNDS) lastOutput = line;
        }
        if (lineCount % Math.max(1, Math.floor(ROUNDS / 100)) === 0 || lineCount === ROUNDS) {
          onProgress(name, Math.floor((lineCount / ROUNDS) * 100), undefined, lineCount, ROUNDS);
        }
      });

      for (let i = 0; i < ROUNDS; i++) {
        if (!child.stdin!.write(encPayload.trim() + '\n')) {
          await new Promise((r) => child.stdin!.once('drain', r));
        }
      }
      child.stdin!.end();

      const runRes = await child;

      if (runRes.exitCode !== 0 && status === 'PASS') {
        status = 'FAIL';
      }

      if (lastOutput !== payload && status !== 'FAIL') {
        status = 'MISMATCH';
        console.error(
          `${name} Mismatch! Expected start: ${payload.substring(0, 50)}... Actual start: ${lastOutput.substring(0, 50)}... Lengths: Exp ${payload.length}, Act ${lastOutput.length}, lineCount: ${lineCount}`,
        );
        console.error(`${name} process exited with code:`, runRes.exitCode);
      }

      const casca_us = casca_us_list.reduce((a, b) => a + b, 0) / (casca_us_list.length || 1);

      const ops_sec = casca_us > 0 ? 1_000_000 / casca_us : 0;
      const casca_cpb = (casca_us * 1000 * freq_ghz) / payload.length;
      const throughput_mbps = casca_us > 0 ? payload.length / 1048576 / (casca_us / 1000000) : 0;

      const resObj = { engine: name, status, casca_us, casca_cpb, ops_sec, throughput_mbps };
      results.push(resObj);
      onProgress(name, 100, resObj, ROUNDS, ROUNDS);
    }),
  );

  return results;
}
