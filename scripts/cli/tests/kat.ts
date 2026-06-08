import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../../../');

const ENGINES = {
  Rust: {
    cwd: path.join(BASE_DIR, 'rust'),
    cmd: [path.join(BASE_DIR, 'rust', 'target', 'release', 'd-asp.exe')],
  },
  C: {
    cwd: path.join(BASE_DIR, 'c'),
    cmd: [path.join(BASE_DIR, 'c', 'dasp.exe')],
  },
  CUDA: {
    cwd: path.join(BASE_DIR, 'cuda'),
    cmd: [path.join(BASE_DIR, 'cuda', 'd-asp_cuda.exe')],
  }
};

export type KatResult = {
  engine: string;
  vectorId: string;
  status: string;
  error?: string;
};

export async function runKatVerification(onProgress: (engine: string, vectorId: string, result?: KatResult) => void): Promise<KatResult[]> {
  const katFile = path.join(BASE_DIR, 'scripts', 'data', 'kat_vectors.json');
  let vectors: any[] = [];
  try {
    const data = await fs.readFile(katFile, 'utf-8');
    vectors = JSON.parse(data);
  } catch (e) {
    throw new Error('kat_vectors.json not found. Run generate KAT vectors first.');
  }

  const results: KatResult[] = [];

  await Promise.all(Object.entries(ENGINES).map(async ([engineName, engine]) => {
    for (const vec of vectors) {
      onProgress(engineName, vec.vector_id);
      
      const ctJsonStr = JSON.stringify(vec.ciphertext_json);
      const skFile = path.join(engine.cwd, 'tmp_sk.hex');
      const dataFile = path.join(engine.cwd, 'tmp_data.json');
      const hwidFile = path.join(engine.cwd, 'tmp_hwid.hex');

      await fs.writeFile(skFile, vec.sk, 'utf-8');
      await fs.writeFile(dataFile, ctJsonStr, 'utf-8');
      if (vec.hwid) await fs.writeFile(hwidFile, vec.hwid, 'utf-8');

      const cmd = [...engine.cmd, 'decrypt', `@${path.resolve(dataFile)}`, `@${path.resolve(skFile)}`];
      if (vec.hwid) cmd.push('--hwid', `@${path.resolve(hwidFile)}`);
      if (engineName !== 'C') cmd.push('--diagnostic');

      let resOutput = '';
      let resStderr = '';
      let exitCode = 0;

      try {
        const subprocess = await execa(cmd[0], cmd.slice(1), { cwd: engine.cwd, reject: false, timeout: 30000 });
        resOutput = subprocess.stdout;
        resStderr = subprocess.stderr;
        exitCode = subprocess.exitCode;
      } catch (e: any) {
        resStderr = e.message;
        exitCode = 1;
      }

      await fs.rm(skFile, { force: true });
      await fs.rm(dataFile, { force: true });
      await fs.rm(hwidFile, { force: true });

      let status = 'PASS';
      let errorMsg = undefined;

      if (exitCode !== 0) {
        status = 'FAIL';
        errorMsg = `CLI ERROR: ${resStderr}`;
      } else {
        const lines = resOutput.split('\n');
        const outputLines = lines.filter((l) => !l.startsWith('{"diagnostics"'));
        const actualPayload = outputLines[outputLines.length - 1]?.trim() || '';

        if (actualPayload !== vec.payload.trim()) {
          status = 'FAIL';
          errorMsg = 'Payload mismatch';
        } else if (engineName !== 'C') {
          let actualDiag: any = {};
          for (const line of resStderr.split('\n').concat(resOutput.split('\n'))) {
            try {
              const obj = JSON.parse(line);
              if (obj.diagnostics) {
                actualDiag = { ...actualDiag, ...obj.diagnostics };
              }
            } catch (e) {}
          }

          const stages = ['stage1_blended_ss', 'stage2_word_key', 'stage3_round_indices', 'stage4_mac'];
          for (const key of stages) {
            if (engineName === 'CUDA' && key === 'stage3_round_indices') continue;
            
            const vExp = vec.diagnostics?.[key];
            const vAct = actualDiag[key];
            if (vExp !== undefined && vAct !== undefined && vExp !== vAct) {
              status = 'FAIL';
              errorMsg = `Diagnostic mismatch: ${key}`;
              break;
            }
          }
        }
      }

      const result = { engine: engineName, vectorId: vec.vector_id, status, error: errorMsg };
      results.push(result);
      onProgress(engineName, vec.vector_id, result);
    }
  }));

  return results;
}
