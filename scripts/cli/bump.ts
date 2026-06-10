import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fs = require('fs');
const path = require('path');
import { execa } from 'execa';

(async () => {
  const { default: ora } = await import('ora');
  const { default: chalk } = await import('chalk');
  const { default: inquirer } = await import('inquirer');

  const pkgPath = path.join(__dirname, '../../package.json');
  const pkg = require(pkgPath);
  const currentVersion = pkg.version;

  console.log(chalk.hex('#00ADD8').bold('\n  📦  Global Version Synchronization\n'));

  const { targetVersion } = await inquirer.prompt([
    {
      type: 'input',
      name: 'targetVersion',
      message: `Enter the new version number (current: ${currentVersion}):`,
      validate: (input: string) => {
        if (!input.match(/^[0-9]+\.[0-9]+\.[0-9]+(-.*)?$/)) {
          return 'Please enter a valid semver string (e.g. 1.0.4, 2.1.0-beta)';
        }
        return true;
      },
    },
  ]);

  if (targetVersion === currentVersion) {
    console.log(chalk.yellow('Version is unchanged. Exiting.'));
    process.exit(0);
  }

  const spinner = ora(chalk.blue(`Bumping global project version to ${targetVersion}...`)).start();

  try {
    const root = path.join(__dirname, '../..');

    // 1. Root package.json & package-lock.json
    await execa('npm', ['version', targetVersion, '--no-git-tag-version', '--allow-same-version'], { cwd: root });

    // 2. Node engine package.json & package-lock.json
    const nodeDir = path.join(root, 'node');
    if (fs.existsSync(nodeDir)) {
      await execa('npm', ['version', targetVersion, '--no-git-tag-version', '--allow-same-version'], { cwd: nodeDir });
    }

    // 3. Rust Cargo.toml
    const cargoTomlPath = path.join(root, 'rust', 'Cargo.toml');
    if (fs.existsSync(cargoTomlPath)) {
      let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
      cargoToml = cargoToml.replace(/^version\s*=\s*".*?"/m, `version = "${targetVersion}"`);
      fs.writeFileSync(cargoTomlPath, cargoToml);

      // Update Cargo.lock
      await execa('cargo', ['update', '-p', 'd-spna-512'], { cwd: path.join(root, 'rust') });
    }

    // 4. README.md Badges
    const readmePath = path.join(root, 'README.md');
    if (fs.existsSync(readmePath)) {
      let readme = fs.readFileSync(readmePath, 'utf8');
      const escapedOldVersion = currentVersion.replace(/\./g, '\\.');
      const regex = new RegExp(`Version-${escapedOldVersion}-blue`, 'g');
      readme = readme.replace(regex, `Version-${targetVersion}-blue`);
      fs.writeFileSync(readmePath, readme);
    }

    spinner.succeed(chalk.green(`Successfully bumped all engines and manifests to v${targetVersion}!`));
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to bump version.'));
    console.error(chalk.dim(error.message));
    process.exit(1);
  }
})();
