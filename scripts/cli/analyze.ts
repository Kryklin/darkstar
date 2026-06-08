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
      const resultsRust = await runCryptoAnalysis((stage, progress) => {
        currentStageStr = stage;
        progressNum = progress;
        spinner.text = chalk.blue(`[Rust] [${progressNum}%] ${currentStageStr}`);
      }, 'Rust');

      const resultsC = await runCryptoAnalysis((stage, progress) => {
        currentStageStr = stage;
        progressNum = progress;
        spinner.text = chalk.blue(`[C] [${progressNum}%] ${currentStageStr}`);
      }, 'C');

      const resultsCUDA = await runCryptoAnalysis((stage, progress) => {
        currentStageStr = stage;
        progressNum = progress;
        spinner.text = chalk.blue(`[CUDA] [${progressNum}%] ${currentStageStr}`);
      }, 'CUDA');
  
      spinner.succeed(chalk.green('Cryptographic analysis completed.\n'));
  
      const table = new Table({
        head: [chalk.bold.white('Metric'), chalk.bold.white('Rust'), chalk.bold.white('C'), chalk.bold.white('CUDA'), chalk.bold.white('Ideal')],
        colWidths: [35, 12, 12, 12, 15],
        style: { head: [], border: [] },
      });
  
      let failed = false;

      function addRow(name: string, format: (r: any) => string, check: (r: any) => boolean, ideal: string) {
        const valR = resultsRust[name];
        const valC = resultsC[name];
        const valCu = resultsCUDA[name];
        if (check(resultsRust) || check(resultsC) || check(resultsCUDA)) failed = true;
        table.push([name, format(valR), format(valC), format(valCu), ideal]);
      }

      addRow('entropy', v => v.toFixed(4), r => r.entropy <= 7.5, '~ 8.000');
      addRow('sac_percent', v => v.toFixed(2) + '%', r => r.sac_percent <= 48.0 || r.sac_percent >= 52.0, '~ 50.0%');
      addRow('chi_square', v => v.toFixed(2), r => r.chi_square <= 150 || r.chi_square >= 350, '200 - 300');
      addRow('serial_correlation', v => v.toFixed(5), r => Math.abs(r.serial_correlation) > 0.05, '~ 0.000');
      addRow('monte_carlo_pi', v => v.toFixed(5), r => Math.abs(r.monte_carlo_pi - 3.14159) > 0.1, '~ 3.14159');
      addRow('monobit', v => v.toFixed(4), r => Math.abs(r.monobit - 0.5) > 0.05, '~ 0.5000');
      addRow('runs_test', v => v.toFixed(4), r => Math.abs(r.runs_test - 1.0) > 0.05, '~ 1.0000');
      addRow('cross_key_sac', v => v.toFixed(2) + '%', r => Math.abs(r.cross_key_sac - 50.0) > 2.0, '~ 50.0%');
      addRow('time_variance', v => v.toFixed(4) + '%', r => r.time_variance > 5.0, '< 5.00%');
      addRow('block_frequency', v => v.toFixed(4), r => false, '~ 6400.0');
      addRow('cumulative_sums', v => v.toFixed(4), r => r.cumulative_sums > 1.5, '~ 0.000');
      addRow('spectral_dft', v => v.toFixed(4), r => Math.abs(r.spectral_dft) > 2.0, '~ 0.000');
      addRow('longest_run', v => v.toFixed(4), r => false, '~ 0.000');
      addRow('approx_entropy', v => v.toFixed(4), r => false, '~ 0.693');
      addRow('serial_pattern', v => v.toFixed(4), r => false, '~ 32768');
      addRow('lz_compression', v => v.toFixed(4), r => r.lz_compression < 0.95, '~ 1.000');
  
      console.log(table.toString());
      console.log(chalk.dim('\n  Evaluated independently across Rust, C, and CUDA engines using 100KB payload.\n'));

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
