import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { execa } from 'execa';
const path = require('path');

(async () => {
  const { default: chalk } = await import('chalk');

  console.log(chalk.hex('#00BCD4').bold('\n  ◈  NIST SP 800-22 Bitstream Generator\n'));
  console.log(chalk.dim('Generating 10MB of pure D-SPNA-512 ciphertext for external statistical testing...'));

  try {
    const rootDir = path.join(__dirname, '../..');

    // Execute the python generator script with inherited stdio so it prints its progress
    await execa('python', ['scripts/tests/gen_nist_bitstream.py'], { cwd: rootDir, stdio: 'inherit' });

    console.log(chalk.green.bold('\n✔ NIST Bitstream Generation Complete!'));
    console.log(chalk.white('File saved to: ') + chalk.cyan('out-releases/nist_bitstream.bin'));
  } catch (error: any) {
    console.error(chalk.red('\n✖ Bitstream generation failed.'));
    console.error(chalk.dim(error.message));
    process.exit(1);
  }
})();
