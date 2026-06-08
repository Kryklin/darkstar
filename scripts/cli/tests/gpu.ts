import { execa } from 'execa';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CUDA_DIR = path.resolve(__dirname, '../../../cuda');

export type GpuTestResult = {
  size_mb: number;
  enc_gbps: number;
  dec_gbps: number;
  match: boolean;
};

export async function runGpuTest(onProgress: (prog: number, total: number, action: string, result?: GpuTestResult) => void): Promise<GpuTestResult[]> {
  const results: GpuTestResult[] = [];

  const cmd = [path.resolve(CUDA_DIR, 'd-asp_test.exe'), '--telemetry'];
  const child = execa(cmd[0], cmd.slice(1), { cwd: CUDA_DIR, reject: false, buffer: false });

  const rl = readline.createInterface({ input: child.stdout! });

  rl.on('line', (line) => {
    try {
      const out_json = JSON.parse(line);
      if (out_json.result === true) {
        const resObj: GpuTestResult = {
          size_mb: out_json.size_mb,
          enc_gbps: out_json.enc_gbps,
          dec_gbps: out_json.dec_gbps,
          match: out_json.match === 'true' || out_json.match === true,
        };
        results.push(resObj);
        onProgress(out_json.progress, out_json.total, 'Completed', resObj);
      } else if (out_json.progress !== undefined) {
        onProgress(out_json.progress, out_json.total, `${out_json.action} ${out_json.size_mb} MB...`);
      }
    } catch (e) {
      // Ignore non-JSON output
    }
  });

  await child;
  return results;
}
