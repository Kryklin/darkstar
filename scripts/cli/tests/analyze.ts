import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../../../');
const RUST_CMD = [path.join(BASE_DIR, 'rust', 'target', 'release', 'd-asp.exe')];
const RUST_CWD = path.join(BASE_DIR, 'rust');

export type CryptoAnalysisResult = {
  entropy: number;
  chi_square: number;
  sac_percent: number;
  serial_correlation: number;
  monte_carlo_pi: number;
  monobit: number;
  runs_test: number;
  cross_key_sac: number;
  time_variance: number;
  block_frequency: number;
  cumulative_sums: number;
};

// Math Utilities
function shannonEntropy(data: Buffer): number {
  if (data.length === 0) return 0.0;
  let entropy = 0;
  for (let x = 0; x < 256; x++) {
    let count = 0;
    for (let i = 0; i < data.length; i++) if (data[i] === x) count++;
    const px = count / data.length;
    if (px > 0) entropy += -px * Math.log2(px);
  }
  return entropy;
}

function chiSquare(data: Buffer): number {
  if (data.length === 0) return 0.0;
  const expected = data.length / 256.0;
  let chi2 = 0.0;
  for (let x = 0; x < 256; x++) {
    let observed = 0;
    for (let i = 0; i < data.length; i++) if (data[i] === x) observed++;
    chi2 += Math.pow(observed - expected, 2) / expected;
  }
  return chi2;
}

function serialCorrelation(data: Buffer): number {
  if (data.length < 2) return 0.0;
  const n = data.length - 1;
  let sum_x = 0,
    sum_y = 0,
    sum_xx = 0,
    sum_yy = 0,
    sum_xy = 0;

  for (let i = 0; i < n; i++) {
    const x = data[i];
    const y = data[i + 1];
    sum_x += x;
    sum_y += y;
    sum_xx += x * x;
    sum_yy += y * y;
    sum_xy += x * y;
  }

  const numerator = n * sum_xy - sum_x * sum_y;
  const denominator = Math.sqrt((n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y));
  return denominator === 0 ? 0.0 : numerator / denominator;
}

function monteCarloPi(data: Buffer): number {
  let pointsInCircle = 0;
  const totalPoints = Math.floor(data.length / 6);
  if (totalPoints === 0) return 0.0;

  for (let i = 0; i < totalPoints; i++) {
    const x = data.readUIntLE(i * 6, 3) / 16777215.0;
    const y = data.readUIntLE(i * 6 + 3, 3) / 16777215.0;
    if (x * x + y * y <= 1.0) pointsInCircle++;
  }
  return (4 * pointsInCircle) / totalPoints;
}

function monobitFrequency(data: Buffer): number {
  const totalBits = data.length * 8;
  let ones = 0;
  for (let i = 0; i < data.length; i++) {
    let b = data[i];
    while (b > 0) {
      if (b & 1) ones++;
      b >>= 1;
    }
  }
  return ones / totalBits;
}

function runsTest(data: Buffer): number {
  const n = data.length * 8;
  if (n === 0) return 0.0;

  let actualRuns = 1;
  let prevBit = (data[0] & 128) >> 7;

  for (let i = 0; i < data.length; i++) {
    for (let bit = 7; bit >= 0; bit--) {
      if (i === 0 && bit === 7) continue;
      const currentBit = (data[i] & (1 << bit)) >> bit;
      if (currentBit !== prevBit) actualRuns++;
      prevBit = currentBit;
    }
  }

  const expectedRuns = n / 2 + 1;
  return actualRuns / expectedRuns;
}

function countBitFlips(hex1: string, hex2: string): number {
  const b1 = Buffer.from(hex1, 'hex');
  const b2 = Buffer.from(hex2, 'hex');
  let flips = 0;
  for (let i = 0; i < Math.min(b1.length, b2.length); i++) {
    let xor = b1[i] ^ b2[i];
    while (xor > 0) {
      if (xor & 1) flips++;
      xor >>= 1;
    }
  }
  return flips;
}

function blockFrequency(data: Buffer, blockSize: number = 128): number {
  const n = data.length * 8;
  const numBlocks = Math.floor(n / blockSize);
  if (numBlocks === 0) return 0.0;
  
  let chiSquare = 0.0;
  for (let i = 0; i < numBlocks; i++) {
    let ones = 0;
    for (let bitIdx = 0; bitIdx < blockSize; bitIdx++) {
      const globalBitIdx = i * blockSize + bitIdx;
      const byteIdx = Math.floor(globalBitIdx / 8);
      const bitInByte = 7 - (globalBitIdx % 8);
      if ((data[byteIdx] & (1 << bitInByte)) !== 0) {
        ones++;
      }
    }
    const proportion = ones / blockSize;
    chiSquare += Math.pow(proportion - 0.5, 2);
  }
  return 4.0 * blockSize * chiSquare;
}

function cumulativeSums(data: Buffer): number {
  const n = data.length * 8;
  if (n === 0) return 0.0;
  
  let sum = 0;
  let maxExcursion = 0;
  
  for (let i = 0; i < data.length; i++) {
    for (let bit = 7; bit >= 0; bit--) {
      const b = (data[i] & (1 << bit)) !== 0 ? 1 : -1;
      sum += b;
      if (Math.abs(sum) > maxExcursion) maxExcursion = Math.abs(sum);
    }
  }
  // Normalize against expected max excursion
  return maxExcursion / Math.sqrt(n);
}

// Engine Wrappers
async function runKeygen(): Promise<{ pk: string; sk: string }> {
  const { stdout } = await execa(RUST_CMD[0], ['keygen'], { cwd: RUST_CWD });
  const lines = stdout.split('\n');
  const pk =
    lines
      .find((l) => l.startsWith('PK:'))
      ?.split('PK:')[1]
      .trim() || '';
  const sk =
    lines
      .find((l) => l.startsWith('SK:'))
      ?.split('SK:')[1]
      .trim() || '';
  return { pk, sk };
}

async function runEncrypt(payload: string, pk: string, telemetry = false): Promise<any> {
  const tmpFile = path.join(RUST_CWD, 'tmp_analyze_payload.txt');
  await fs.writeFile(tmpFile, payload, 'utf-8');

  const args = ['encrypt', `@${tmpFile}`, pk];
  if (telemetry) args.push('--telemetry');

  const { stdout } = await execa(RUST_CMD[0], args, { cwd: RUST_CWD });
  await fs.rm(tmpFile, { force: true });

  const lines = stdout.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('{')) return JSON.parse(lines[i]);
  }
  return JSON.parse(stdout.trim());
}

export async function runCryptoAnalysis(onProgress: (stage: string, progress: number) => void): Promise<CryptoAnalysisResult> {
  onProgress('Keygen', 0);
  const { pk } = await runKeygen();

  onProgress('Baseline Statistical Tests', 10);
  const basePayload = 'A'.repeat(102400); // 100KB
  const baseCt = await runEncrypt(basePayload, pk);
  const ctHex = baseCt.data;
  const ctBytes = Buffer.from(ctHex, 'hex');

  const entropy = shannonEntropy(ctBytes);
  const chi2 = chiSquare(ctBytes);
  const serialCorr = serialCorrelation(ctBytes);
  const piEst = monteCarloPi(ctBytes);
  const monobit = monobitFrequency(ctBytes);
  const runsRatio = runsTest(ctBytes);
  const blockFreq = blockFrequency(ctBytes);
  const cusum = cumulativeSums(ctBytes);

  onProgress('Strict Avalanche Criterion (SAC)', 40);
  const payloadStr = 'CRYPTOGRAPHIC_AVALANCHE_TEST_PAYLOAD_1234567890';
  const baseCtSac = (await runEncrypt(payloadStr, pk)).data;

  // Use character-level mutation to keep payloads as valid UTF-8.
  // For each iteration, change a single character to a different printable ASCII char.
  const ASCII_PRINTABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const flipPercentages: number[] = [];
  for (let i = 0; i < 20; i++) {
    const chars = payloadStr.split('');
    const charIdx = Math.floor(Math.random() * chars.length);
    // Pick a different character from the printable set
    let replacement = chars[charIdx];
    while (replacement === chars[charIdx]) {
      replacement = ASCII_PRINTABLE[Math.floor(Math.random() * ASCII_PRINTABLE.length)];
    }
    chars[charIdx] = replacement;
    const mutatedStr = chars.join('');

    const mutatedCtSac = (await runEncrypt(mutatedStr, pk)).data;
    if (baseCtSac.length === mutatedCtSac.length) {
      const flips = countBitFlips(baseCtSac, mutatedCtSac);
      const totalBits = baseCtSac.length * 4;
      flipPercentages.push((flips / totalBits) * 100.0);
    }
    onProgress('Strict Avalanche Criterion (SAC)', 40 + i * 2);
  }
  const avgSac = flipPercentages.reduce((a, b) => a + b, 0) / (flipPercentages.length || 1);

  onProgress('Cross-Key Avalanche', 80);
  const { pk: pk2 } = await runKeygen();
  const crossKeyCt = (await runEncrypt(basePayload, pk2)).data;
  const crossKeyDiff = countBitFlips(ctHex, crossKeyCt);
  const crossKeySacPercent = (crossKeyDiff / (ctHex.length * 4)) * 100.0;

  onProgress('Constant-Time Verification', 90);
  const zerosPayload = '0'.repeat(1024 * 1024);
  const onesPayload = 'A'.repeat(1024 * 1024);

  const timingZeros = (await runEncrypt(zerosPayload, pk, true)).timings || {};
  const timingOnes = (await runEncrypt(onesPayload, pk, true)).timings || {};

  const zTime = timingZeros.total_pipeline_us || 1;
  const oTime = timingOnes.total_pipeline_us || 1;
  const timeVariance = (Math.abs(zTime - oTime) / zTime) * 100.0;

  onProgress('Done', 100);
  return {
    entropy,
    chi_square: chi2,
    sac_percent: avgSac,
    serial_correlation: serialCorr,
    monte_carlo_pi: piEst,
    monobit,
    runs_test: runsRatio,
    cross_key_sac: crossKeySacPercent,
    time_variance: timeVariance,
    block_frequency: blockFreq,
    cumulative_sums: cusum,
  };
}
