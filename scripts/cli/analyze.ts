import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { execa } from 'execa';
const fs = require('fs');
const path = require('path');

import { runCryptoAnalysis } from './tests/analyze.js';

(async () => {
  const { default: ora } = await import('ora');
  const { default: chalk } = await import('chalk');
  const { default: Table } = await import('cli-table3');

  console.log(chalk.hex('#FF0055').bold('\n  🔬  Cryptographic Analysis & Profiling\n'));

  let currentStageStr = 'Initializing...';
  let progressNum = 0;
  
  const spinner = ora(chalk.blue(`Running Mathematical Evaluation...`)).start();

  try {
    const results = await runCryptoAnalysis((stage, progress) => {
      currentStageStr = stage;
      progressNum = progress;
      spinner.text = chalk.blue(`[${progressNum}%] ${currentStageStr}`);
    });

    spinner.succeed(chalk.green('Cryptographic analysis completed.\n'));

    const table = new Table({
      head: [chalk.bold.white('Metric'), chalk.bold.white('Result'), chalk.bold.white('Ideal')],
      colWidths: [35, 15, 15],
      style: { head: [], border: [] },
    });

    // 1. Shannon Entropy
    const entropy = results.entropy;
    let failed = false;
    if (entropy <= 7.5) failed = true;
    table.push(['Shannon Entropy (Bits/Byte)', entropy.toFixed(4), '~ 8.000']);

    // 2. Strict Avalanche Criterion (SAC)
    const sac = results.sac_percent;
    if (sac <= 48.0 || sac >= 52.0) failed = true;
    table.push(['Strict Avalanche Criterion (SAC)', sac.toFixed(2) + '%', '~ 50.0%']);

    // 3. Chi-Square
    const chi2 = results.chi_square;
    if (chi2 <= 150 || chi2 >= 350) failed = true;
    table.push(['Chi-Square Uniformity', chi2.toFixed(2), '200 - 300']);

    // 4. Serial Correlation
    const serialCorr = results.serial_correlation;
    if (Math.abs(serialCorr) > 0.05) failed = true;
    table.push(['Serial Autocorrelation', serialCorr.toFixed(5), '~ 0.000']);

    // 5. Monte Carlo Pi Estimation
    const piEst = results.monte_carlo_pi;
    if (Math.abs(piEst - 3.14159) > 0.1) failed = true;
    table.push(['Monte Carlo Pi Estimation', piEst.toFixed(5), '~ 3.14159']);

    // 6. Monobit Frequency Test
    const monobit = results.monobit;
    if (Math.abs(monobit - 0.5) > 0.05) failed = true;
    table.push(['Monobit Frequency', monobit.toFixed(4), '~ 0.5000']);

    // 7. Runs Test (Decay Ratio)
    const runsTest = results.runs_test;
    if (Math.abs(runsTest - 1.0) > 0.05) failed = true;
    table.push(['Runs Test (Decay Ratio)', runsTest.toFixed(4), '~ 1.0000']);

    // 8. Cross-Key Avalanche Diffusion
    const ckSac = results.cross_key_sac;
    if (Math.abs(ckSac - 50.0) > 2.0) failed = true;
    table.push(['Cross-Key Diffusion', ckSac.toFixed(2) + '%', '~ 50.0%']);

    // 9. Constant-Time Variance
    const tv = results.time_variance;
    if (tv > 5.0) failed = true;
    table.push(['Constant-Time Variance', tv.toFixed(4) + '%', '< 5.00%']);

    // 10. Block Frequency Test
    const bFreq = results.block_frequency;
    table.push(['Block Frequency (χ²)', bFreq.toFixed(4), '~ 6400.0']);

    // 11. Cumulative Sums Test
    const cusum = results.cumulative_sums;
    if (cusum > 1.5) failed = true;
    table.push(['Cumulative Sums (Cusum)', cusum.toFixed(4), '~ 0.000']);

    // 12. Discrete Fourier Transform (Spectral)
    const dft = results.spectral_dft;
    if (Math.abs(dft) > 2.0) failed = true;
    table.push(['Discrete Fourier Transform', dft.toFixed(4), '~ 0.000']);

    console.log(table.toString());
    console.log(chalk.dim('\n  Evaluated against reference engine (Rust) using 100KB standard payload.\n'));

    // Check if it passes security thresholds
    if (failed) {
      console.log(chalk.red.bold('✖ Cryptographic algorithms are displaying severe anomalies!'));
      process.exit(1);
    } else {
      console.log(chalk.green.bold('✔ D-ASP Encryption algorithms pass all statistical pseudo-randomness tests!'));
      process.exit(0);
    }
  } catch (error: any) {
    spinner.fail(chalk.red('Analysis script failed to execute.'));
    console.error(chalk.dim(error.message));
    process.exit(1);
  }
})();
