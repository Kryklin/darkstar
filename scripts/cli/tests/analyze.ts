import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../../../');

const ENGINES: Record<string, { cwd: string; cmd: string[] }> = {
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
  },
};

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
  spectral_dft: number;
  longest_run: number;
  longest_run: number;
  approx_entropy: number;
  serial_pattern: number;
  lz_compression: number;
  time_variance: number;
};

import zlib from 'zlib';

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

function spectralTest(data: Buffer): number {
  const totalBits = data.length * 8;
  // Find largest power of 2 <= totalBits
  let n = 1;
  while (n * 2 <= totalBits) n *= 2;
  
  if (n < 4) return 0;
  
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  
  for (let i = 0; i < n; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitInByte = 7 - (i % 8);
    const bit = (data[byteIdx] & (1 << bitInByte)) !== 0 ? 1 : -1;
    real[i] = bit;
    imag[i] = 0;
  }
  
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let temp = real[i]; real[i] = real[j]; real[j] = temp;
      temp = imag[i]; imag[i] = imag[j]; imag[j] = temp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }
  
  // Cooley-Tukey FFT
  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const angle = -2 * Math.PI / size;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    
    for (let i = 0; i < n; i += size) {
      let uReal = 1;
      let uImag = 0;
      for (let j = 0; j < halfSize; j++) {
        const k = i + j;
        const l = i + j + halfSize;
        
        const tReal = uReal * real[l] - uImag * imag[l];
        const tImag = uReal * imag[l] + uImag * real[l];
        
        real[l] = real[k] - tReal;
        imag[l] = imag[k] - tImag;
        
        real[k] += tReal;
        imag[k] += tImag;
        
        const nextUReal = uReal * wReal - uImag * wImag;
        uImag = uReal * wImag + uImag * wReal;
        uReal = nextUReal;
      }
    }
  }
  
  // Calculate magnitudes and count peaks
  const threshold = Math.sqrt(Math.log(1 / 0.05) * n);
  const n0 = 0.95 * (n / 2);
  let n1 = 0;
  
  // Due to symmetry, only check first n/2 elements
  for (let i = 0; i < n / 2; i++) {
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    if (mag < threshold) n1++;
  }
  
  const d = (n1 - n0) / Math.sqrt(n * 0.95 * 0.05 / 4);
  return d;
}

function longestRunOfOnes(data: Buffer): number {
  const blockSize = 128;
  const n = data.length * 8;
  const numBlocks = Math.floor(n / blockSize);
  if (numBlocks === 0) return 0;
  
  const v = [0, 0, 0, 0, 0, 0, 0];
  const pi = [0.1174, 0.2430, 0.2493, 0.1753, 0.1027, 0.1124];
  
  for (let i = 0; i < numBlocks; i++) {
    let maxRun = 0;
    let currentRun = 0;
    for (let bitIdx = 0; bitIdx < blockSize; bitIdx++) {
      const globalBitIdx = i * blockSize + bitIdx;
      const byteIdx = Math.floor(globalBitIdx / 8);
      const bitInByte = 7 - (globalBitIdx % 8);
      if ((data[byteIdx] & (1 << bitInByte)) !== 0) {
        currentRun++;
        if (currentRun > maxRun) maxRun = currentRun;
      } else {
        currentRun = 0;
      }
    }
    if (maxRun <= 4) v[0]++;
    else if (maxRun === 5) v[1]++;
    else if (maxRun === 6) v[2]++;
    else if (maxRun === 7) v[3]++;
    else if (maxRun === 8) v[4]++;
    else v[5]++;
  }
  
  let chi2 = 0;
  for (let i = 0; i < 6; i++) {
    const expected = numBlocks * pi[i];
    if (expected > 0) chi2 += Math.pow(v[i] - expected, 2) / expected;
  }
  return chi2;
}

function approximateEntropy(data: Buffer, m: number = 10): number {
  const n = data.length * 8;
  if (n === 0) return 0.0;
  
  const getBit = (idx: number) => {
    const byteIdx = Math.floor((idx % n) / 8);
    const bitInByte = 7 - ((idx % n) % 8);
    return (data[byteIdx] & (1 << bitInByte)) !== 0 ? 1 : 0;
  };
  
  const phi = (mSize: number) => {
    if (mSize === 0) return 0;
    const counts = new Int32Array(1 << mSize);
    const mask = (1 << mSize) - 1;
    let pattern = 0;
    for (let j = 0; j < mSize - 1; j++) {
      pattern = (pattern << 1) | getBit(j);
    }
    for (let i = 0; i < n; i++) {
      pattern = ((pattern << 1) | getBit(i + mSize - 1)) & mask;
      counts[pattern]++;
    }
    let sum = 0;
    for (let i = 0; i < counts.length; i++) {
      const count = counts[i];
      if (count > 0) {
        const p = count / n;
        sum += p * Math.log(p);
      }
    }
    return sum;
  };
  
  return phi(m) - phi(m + 1);
}

function serialTest(data: Buffer, m: number = 16): number {
  const n = data.length * 8;
  if (n === 0) return 0.0;
  
  const getBit = (idx: number) => {
    const byteIdx = Math.floor((idx % n) / 8);
    const bitInByte = 7 - ((idx % n) % 8);
    return (data[byteIdx] & (1 << bitInByte)) !== 0 ? 1 : 0;
  };
  
  const psi = (mSize: number) => {
    if (mSize === 0) return 0;
    const counts = new Int32Array(1 << mSize);
    const mask = (1 << mSize) - 1;
    let pattern = 0;
    for (let j = 0; j < mSize - 1; j++) {
      pattern = (pattern << 1) | getBit(j);
    }
    for (let i = 0; i < n; i++) {
      pattern = ((pattern << 1) | getBit(i + mSize - 1)) & mask;
      counts[pattern]++;
    }
    let sum = 0;
    for (let i = 0; i < counts.length; i++) {
      const count = counts[i];
      if (count > 0) sum += count * count;
    }
    return (Math.pow(2, mSize) / n) * sum - n;
  };
  
  const psiM = psi(m);
  const psiM1 = psi(m - 1);
  
  return psiM - psiM1;
}

function lzCompressionTest(data: Buffer): number {
  if (data.length === 0) return 1.0;
  const compressed = zlib.deflateSync(data, { level: 9 });
  return compressed.length / data.length;
}

// Engine Wrappers
async function runKeygen(engine: 'Rust'|'C'|'CUDA' = 'Rust'): Promise<{ pk: string; sk: string }> {
  const { stdout } = await execa(ENGINES[engine].cmd[0], ['keygen'], { cwd: ENGINES[engine].cwd });
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

async function runEncrypt(payload: string, pk: string, telemetry = false, engine: 'Rust' | 'C' | 'CUDA' = 'Rust'): Promise<any> {
  const eng = ENGINES[engine];
  const tmpFile = path.join(eng.cwd, 'tmp_analyze_payload.txt');
  await fs.writeFile(tmpFile, payload, 'utf-8');

  const args = ['encrypt', `@${tmpFile}`, pk];
  if (telemetry) args.push('--telemetry');

  const { stdout } = await execa(eng.cmd[0], args, { cwd: eng.cwd });
  await fs.rm(tmpFile, { force: true });

  const lines = stdout.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('{')) return JSON.parse(lines[i]);
  }
  return JSON.parse(stdout.trim());
}

export async function runCryptoAnalysis(onProgress: (stage: string, progress: number) => void, engine: 'Rust' | 'C' | 'CUDA' = 'Rust'): Promise<CryptoAnalysisResult> {
  onProgress('Keygen', 0);
  const { pk } = await runKeygen(engine);

  onProgress('Baseline Statistical Tests', 10);
  const basePayload = 'A'.repeat(102400); // 100KB
  
  const baseCt = await runEncrypt(basePayload, pk, false, engine);
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
  const spectral = spectralTest(ctBytes);
  const longest = longestRunOfOnes(ctBytes);
  const apen = approximateEntropy(ctBytes);
  const serial = serialTest(ctBytes);
  const lzRatio = lzCompressionTest(ctBytes);

  onProgress('Strict Avalanche Criterion (SAC)', 40);
  const payloadStr = 'CRYPTOGRAPHIC_AVALANCHE_TEST_PAYLOAD_1234567890';
  const baseCtSac = (await runEncrypt(payloadStr, pk, false, engine)).data;

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

    const mutatedCtSac = (await runEncrypt(mutatedStr, pk, false, engine)).data;
    if (baseCtSac.length === mutatedCtSac.length) {
      const flips = countBitFlips(baseCtSac, mutatedCtSac);
      const totalBits = baseCtSac.length * 4;
      flipPercentages.push((flips / totalBits) * 100.0);
    }
    onProgress('Strict Avalanche Criterion (SAC)', 40 + i * 2);
  }
  const avgSac = flipPercentages.reduce((a, b) => a + b, 0) / (flipPercentages.length || 1);

  onProgress('Cross-Key Avalanche', 80);
  const { pk: pk2 } = await runKeygen(engine);
  const crossKeyCt = (await runEncrypt(basePayload, pk2, false, engine)).data;
  const crossKeyDiff = countBitFlips(ctHex, crossKeyCt);
  const crossKeySacPercent = (crossKeyDiff / (ctHex.length * 4)) * 100.0;

  onProgress('Constant-Time Verification', 90);
  const zerosPayload = '0'.repeat(1024 * 1024);
  const onesPayload = 'A'.repeat(1024 * 1024);

  const timingZeros = (await runEncrypt(zerosPayload, pk, true, engine)).timings || {};
  const timingOnes = (await runEncrypt(onesPayload, pk, true, engine)).timings || {};

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
    spectral_dft: spectral,
    longest_run: longest,
    approx_entropy: apen,
    serial_pattern: serial,
    lz_compression: lzRatio,
  };
}
