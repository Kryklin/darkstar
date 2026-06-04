import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');

(async () => {
  // Dynamic imports for ESM packages
  const { default: ora } = await import('ora');
  const { default: chalk } = await import('chalk');
  const { default: inquirer } = await import('inquirer');
  const { execa } = await import('execa');

  // Basic .env loader to support GitHub tokens without terminal restarts
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line: string) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts
          .join('=')
          .trim()
          .replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    });
  }

  /**
   * Clears the terminal and displays the project header.
   * Hardened security-professional aesthetic with status indicators.
   */
  function printHeader() {
    console.clear();
    const g = chalk.hex('#00FF41'); // Matrix green
    const d = chalk.hex('#333333'); // Dark muted
    const w = chalk.hex('#AAAAAA'); // Muted white
    const accent = chalk.hex('#00ADD8'); // Cyan accent

    console.log('');
    console.log(g.bold('  D - A S P   ') + chalk.hex('#555555')('│') + accent.bold('   D A R K S T A R   C L I'));
    console.log(d('  ══════════════════════════════════════════════════════════════'));
    console.log(w(`  ${pkg.description}`));
    console.log(d('  ──────────────────────────────────────────────────────────────'));
    console.log(w(`  Version  `) + accent(pkg.version) + w('  │  ') + w('License  ') + accent(pkg.license) + w('  │  ') + w('Author  ') + accent(pkg.author));
    console.log(d('  ══════════════════════════════════════════════════════════════\n'));
  }

  // --- Menu Configuration ---
  // Color coding:
  //   Green  (#00FF41) = Build / Compile operations
  //   Cyan   (#00BCD4) = Verification / Testing
  //   Yellow (#FFD600) = Code Quality
  //   Red    (#FF1744) = Security / Destructive
  //   White  = System / Utility

  const choices = [
    new inquirer.Separator(chalk.hex('#555555')('─── Build ────────────────────────────────────────────────')),
    { name: chalk.hex('#00FF41')('  ⚙  Compile Engines            ') + chalk.dim('Rust, Go, C, CUDA, Node, Python, C#, Zig'), value: 'build-engines' },
    { name: chalk.hex('#00FF41')('  ◉  Environment Preflight      ') + chalk.dim('Verify toolchains & dependencies'), value: 'check-env' },

    new inquirer.Separator(chalk.hex('#555555')('─── Verification ─────────────────────────────────────────')),
    { name: chalk.hex('#00BCD4')('  ◈  Interop Benchmark          ') + chalk.dim('Cross-engine bit-perfect parity'), value: 'interop' },
    { name: chalk.hex('#00BCD4')('  ◈  Generate KAT Vectors       ') + chalk.dim('NIST Known Answer Test data'), value: 'gen-kat' },
    { name: chalk.hex('#00BCD4')('  ◈  KAT Verification           ') + chalk.dim('Validate against reference vectors'), value: 'kat' },
    { name: chalk.hex('#00BCD4')('  ◈  Headless Docker Matrix     ') + chalk.dim('Off-host containerized validation'), value: 'docker-test' },

    new inquirer.Separator(chalk.hex('#555555')('─── Security & Audit ─────────────────────────────────────')),
    { name: chalk.hex('#FF1744')('  ▲  Memory Sanitizers          ') + chalk.dim('ASan/MSan on C & Rust engines'), value: 'asan' },
    { name: chalk.hex('#FF1744')('  ▲  Security Audit             ') + chalk.dim('CVE scan across all dependencies'), value: 'audit' },
    { name: chalk.hex('#FFD600')('  △  License Compliance         ') + chalk.dim('OSS license compatibility check'), value: 'license-audit' },

    new inquirer.Separator(chalk.hex('#555555')('─── Code Quality ─────────────────────────────────────────')),
    { name: chalk.hex('#FFD600')('  ◇  Lint                       ') + chalk.dim('Static analysis & style enforcement'), value: 'lint' },
    { name: chalk.hex('#FFD600')('  ◇  Format                     ') + chalk.dim('Polyglot auto-formatter'), value: 'format' },

    new inquirer.Separator(chalk.hex('#555555')('─── Release ──────────────────────────────────────────────')),
    { name: chalk.hex('#00ADD8')('  ◆  Bump Project Version       ') + chalk.dim('Synchronize version string globally'), value: 'bump' },
    { name: chalk.hex('#00ADD8')('  ◆  Publish to GitHub Releases ') + chalk.dim('Package & upload engine artifacts'), value: 'publish' },

    new inquirer.Separator(chalk.hex('#555555')('─── System ───────────────────────────────────────────────')),
    { name: chalk.hex('#888888')('  ○  Deep Clean                 ') + chalk.dim('Purge build artifacts & caches'), value: 'clean' },
    { name: chalk.hex('#FF1744').bold('  ✕  Exit'), value: 'exit' },
  ];

  /**
   * Executes a shell command with a spinner and error handling.
   *
   * @param {string} stepName - Display name for the step (e.g. "Linting")
   * @param {string} command - Command to execute
   * @param {string[]} [args=[]] - Arguments for the command
   * @param {object} [options={}] - Extra options for execa
   */
  async function runStep(stepName: string, command: string, args: string[] = [], options: Record<string, unknown> = {}) {
    // Extract custom options from execa options
    const { clear = true, showOutput = false, ...execaOptions } = options;

    if (clear) {
      printHeader(); // Refresh header for unified UI
    }

    const spinner = ora(chalk.blue(`Running ${stepName}...`)).start();
    try {
      if (showOutput) {
        spinner.stop(); // Stop spinner to stream output to console directly
        console.log(chalk.dim(`\n> Executing: ${command} ${args.join(' ')}\n`));
      }

      // Execute command, inheriting stdio only if showOutput is true
      const stdioMode = showOutput ? 'inherit' : 'pipe';
      await execa(command, args, { stdio: stdioMode, preferLocal: true, ...execaOptions });

      if (showOutput) {
        console.log(chalk.green.bold(`\n✔ ${stepName} Completed Successfully!\n`));
      } else {
        spinner.succeed(chalk.green.bold(`${stepName} Completed Successfully!`));
      }
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string };
      if (!showOutput) {
        spinner.fail(chalk.red.bold(`${stepName} Failed!`));
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(chalk.red(error.stderr));
      } else {
        console.log(chalk.red.bold(`\n✖ ${stepName} Failed!`));
      }
      throw error;
    }
  }

  /**
   * Wrapper for executing complex shell strings.
   *
   * @param {string} stepName
   * @param {string} shellCommand
   * @param {object} [options={}]
   */
  async function runShell(stepName: string, shellCommand: string, options: Record<string, unknown> = {}) {
    await runStep(stepName, shellCommand, [], { shell: true, ...options });
  }

  /**
   * Environment Checker
   * Checks for required development dependencies and offers to install them via winget.
   *
   * @param {boolean} interactive - Whether to prompt for installation via winget
   */
  async function checkEnvironment(interactive = false) {
    if (interactive) printHeader();
    const spinner = ora(chalk.blue('Checking development environment...')).start();

    // Inject common installation paths into process.env.PATH so newly installed tools are detected without a terminal restart
    const commonPaths = ['C:\\Program Files\\LLVM\\bin', 'C:\\Program Files\\Go\\bin', path.join(process.env.USERPROFILE || '', '.cargo', 'bin')];
    for (const p of commonPaths) {
      if (process.env.PATH && !process.env.PATH.includes(p) && fs.existsSync(p)) {
        process.env.PATH = `${p}${path.delimiter}${process.env.PATH}`;
      }
    }

    const deps = [
      { name: 'C Compiler (clang/gcc)', cmd: 'clang', args: ['--version'], pkg: 'LLVM.LLVM', installer: 'winget' },
      { name: 'Rust (cargo)', cmd: 'cargo', args: ['--version'], pkg: 'Rustlang.Rustup', installer: 'winget' },
      { name: 'Go', cmd: 'go', args: ['version'], pkg: 'GoLang.Go', installer: 'winget' },
      { name: 'Python', cmd: 'python', args: ['--version'], pkg: 'Python.Python.3.11', installer: 'winget' },
      { name: 'Rust Audit (cargo-audit)', cmd: 'cargo-audit', args: ['--version'], pkg: 'cargo-audit', installer: 'cargo' },
      { name: 'Go Audit (govulncheck)', cmd: 'govulncheck', args: ['-version'], pkg: 'golang.org/x/vuln/cmd/govulncheck@latest', installer: 'go' },
      { name: 'Python Audit (pip-audit)', cmd: 'python', args: ['-m', 'pip_audit', '--version'], pkg: 'pip-audit', installer: 'pip' },
      { name: 'Python Formatter (black)', cmd: 'python', args: ['-m', 'black', '--version'], pkg: 'black', installer: 'pip' },
      { name: '.NET (dotnet)', cmd: 'dotnet', args: ['--version'], pkg: 'Microsoft.DotNet.SDK.8', installer: 'winget' },
      { name: 'Zig', cmd: 'zig', args: ['version'], pkg: 'zig.zig', installer: 'winget' },
    ];

    const missing = [];

    for (const dep of deps) {
      try {
        await execa(dep.cmd, dep.args, { preferLocal: true, shell: process.platform === 'win32' });
        if (interactive) console.log(chalk.green(`✔ ${dep.name} is installed.`));
      } catch (_e) {
        // Try fallback for C compiler if clang fails
        if (dep.cmd === 'clang') {
          try {
            await execa('gcc', ['--version'], { preferLocal: true, shell: process.platform === 'win32' });
            if (interactive) console.log(chalk.green(`✔ C Compiler (gcc) is installed.`));
            continue;
          } catch (_e2) {
            // Try explicit LLVM path fallback
            try {
              await execa('C:\\Program Files\\LLVM\\bin\\clang.exe', ['--version']);
              if (interactive) console.log(chalk.green(`✔ C Compiler (clang) is installed at C:\\Program Files\\LLVM.`));
              continue;
            } catch (_e3) {
              // Both failed
            }
          }
        }
        if (interactive) console.log(chalk.red(`✖ ${dep.name} is missing.`));
        missing.push(dep);
      }
    }

    spinner.stop();

    if (missing.length === 0) {
      if (interactive) console.log(chalk.bold.green('\n✨ All development tools are installed! ✨\n'));
      return true;
    }

    if (!interactive) {
      throw new Error(`Missing required development tools: ${missing.map((m) => m.name).join(', ')}.\nPlease run the "Run Dev Environment Check" from the main menu to install them.`);
    }

    console.log(chalk.yellow(`\nMissing tools detected: ${missing.map((m) => m.name).join(', ')}`));
    const { install } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: 'Would you like to install the missing dependencies via winget? (Requires UAC Administrator privileges)',
        default: true,
      },
    ]);

    if (install) {
      for (const dep of missing) {
        const installSpinner = ora(chalk.blue(`Installing ${dep.name}...`)).start();
        try {
          if (dep.installer === 'winget') {
            // Elevated powershell process for winget installation
            const psCommand = `Start-Process -Wait -Verb RunAs "winget" -ArgumentList "install", "${dep.pkg}", "--silent", "--accept-package-agreements", "--accept-source-agreements"`;
            await execa('powershell', ['-NoProfile', '-Command', psCommand]);
          } else if (dep.installer === 'cargo') {
            await execa('cargo', ['install', dep.pkg], { preferLocal: true });
          } else if (dep.installer === 'go') {
            await execa('go', ['install', dep.pkg], { preferLocal: true });
          } else if (dep.installer === 'pip') {
            await execa('python', ['-m', 'pip', 'install', dep.pkg], { preferLocal: true });
          }
          installSpinner.succeed(chalk.green(`Successfully installed ${dep.name}!`));
        } catch (err: unknown) {
          installSpinner.fail(chalk.red(`Failed to install ${dep.name}.`));
          console.error(chalk.dim((err as Error).message));
        }
      }
      console.log(chalk.yellow.bold('\nℹ Note: You may need to restart your terminal or PC for the newly installed tools to be available in your PATH.'));
    }

    return false;
  }

  // --- Main Execution Loop ---
  while (true) {
    printHeader();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: chalk.hex('#AAAAAA')('Select operation:'),
        choices,
        prefix: chalk.hex('#00FF41')('›'),
      },
    ]);

    if (action === 'exit') {
      console.log(chalk.hex('#555555')('  Session terminated.'));
      process.exit(0);
    }

    /**
     * Command Definitions
     * Centralized configuration for all build/test/release commands.
     */
    const CMD = {
      LINT: 'npm run lint',
      // Karma: Runs headless Angular unit tests
      KARMA: 'ng test --watch=false --browsers=ChromeHeadless',
      // Interop: Executes the Python interop verification script
      INTEROP: 'npm run test:interop',
      // Gen KAT: Generates the Known Answer Test vectors
      GEN_KAT: 'npm run test:gen-kat',
      // KAT: Runs the Known Answer Test suite for bit-perfect parity check
      KAT: 'npm run test:kat',
      // Build: Compiles Angular (Production) and Electron (TypeScript), then generates integrity
      BUILD: 'ng build --configuration production --base-href ./ && tsc --p tsconfig.electron.json && node scripts/build-integrity.js',
      // Dev: Runs Angular Serve and Electron Watch (via Wrapper) concurrently
      DEV: 'concurrently -k --success first "ng serve" "wait-on http://localhost:4200 && node scripts/dev-wrapper.js"',
      // Build Native Engines: Compiles Rust, Go, C, and CUDA binaries
      BUILD_ENGINES: 'npm run build:engines',
      // Package: Packages the Electron app using Forge
      PACKAGE: 'electron-forge package',
      // Publish: Publishes the Electron app using Forge
      PUBLISH: 'electron-forge publish',
      // Mobile: Capacitor Commands
      CAP_SYNC: 'npx cap sync',
      CAP_OPEN_ANDROID: 'npx cap open android',
      CAP_OPEN_IOS: 'npx cap open ios',
      // Docker: Headless environment testing
      DOCKER_TEST: 'docker compose -f docker-compose.yml build && python "scripts/verify_interop.py" --docker',
      // Format: Runs polyglot code formatters
      FORMAT: 'npm run format',
      // Audit: Runs polyglot security audits
      AUDIT: 'npm run audit',
      // Clean: Purges the workspace
      CLEAN: 'npm run clean',
      // Checksums: Generates SHA-256 artifact hashes
      CHECKSUMS: 'npm run checksums',
      // Publish: Compresses and uploads binaries to GitHub Releases
      PUBLISH_ENGINES: 'npm run publish',
    };

    // Execute selected action
    try {
      if (action === 'all') {
        await checkEnvironment(false); // Fail-safe dependency check

        const stages = [
          { name: 'Linting', cmd: CMD.LINT },
          { name: 'Testing (Angular)', cmd: CMD.KARMA, options: { showOutput: true } },
          { name: 'Testing (Interop)', cmd: CMD.INTEROP, options: { showOutput: true } },
          { name: 'Testing (KAT)', cmd: CMD.KAT, options: { showOutput: true } },
          { name: 'Building', cmd: CMD.BUILD, options: { showOutput: true } },
          { name: 'Publishing', cmd: CMD.PUBLISH, options: { clear: false, showOutput: true } },
        ];

        for (let i = 0; i < stages.length; i++) {
          const stage = stages[i];

          if (stage.name === 'Publishing' && !process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
            console.log(chalk.red.bold('\n⚠️  Error: GITHUB_TOKEN not found in environment.'));
            console.log(chalk.yellow('Publishing requires a GitHub Personal Access Token.'));
            console.log(chalk.yellow('Please create a .env file in the root directory with:'));
            console.log(chalk.cyan('GITHUB_TOKEN=your_token_here\n'));
            break;
          }

          const stageNameWithProgress = `[Stage ${i + 1}/${stages.length}] ${stage.name}`;
          await runShell(stageNameWithProgress, stage.cmd, stage.options || { clear: true });

          if (i < stages.length - 1) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        console.log(chalk.bold.green('\n✨ Full Release Pipeline Completed! ✨\n'));
      } else {
        switch (action) {
          case 'check-env':
            await checkEnvironment(true);
            break;
          case 'docker-test':
            await runShell('Headless Docker Test', CMD.DOCKER_TEST, { showOutput: true });
            break;

          case 'lint':
            await runShell('Linting', CMD.LINT);
            break;
          case 'format':
            await runShell('Formatting', CMD.FORMAT);
            break;
          case 'audit':
            await runShell('Security Audit', CMD.AUDIT, { showOutput: true });
            break;
          case 'asan':
            await runShell('Memory Sanitizers', 'npx tsx scripts/cli/asan.ts', { showOutput: true });
            break;
          case 'license-audit':
            await runShell('License Audit', 'npx tsx scripts/cli/license-audit.ts', { showOutput: true });
            break;
          case 'clean':
            await runShell('Cleaning Workspace', CMD.CLEAN, { clear: false });
            break;

          case 'interop':
            await checkEnvironment(false);
            await runShell('Interop Benchmarking', CMD.INTEROP, { showOutput: true });
            break;
          case 'build-engines':
            await runShell('Building Crypto Engines', CMD.BUILD_ENGINES, { showOutput: true });
            break;
          case 'gen-kat':
            await checkEnvironment(false);
            await runShell('Generate KAT Vectors', CMD.GEN_KAT, { showOutput: true });
            break;
          case 'kat':
            if (!fs.existsSync(path.join(__dirname, '../data/kat_vectors.json'))) {
              console.log(chalk.yellow.bold('\n⚠️  Warning: kat_vectors.json not found!'));
              console.log(chalk.yellow('Please run "Generate KAT Vectors" from the menu first before running KAT verification.\n'));
              break;
            }
            await checkEnvironment(false);
            await runShell('KAT Verification', CMD.KAT, { showOutput: true });
            break;
          case 'publish':
            await runShell('Publish Engine Artifacts', CMD.PUBLISH_ENGINES, { showOutput: true });
            break;
          case 'bump':
            // Instead of runShell which waits and suppresses interactive prompts, we just spawn inherit directly or runShell with interactive
            // Actually, because bump is interactive, we should just let execa run it with stdio: 'inherit'
            await execa('npm', ['run', 'bump'], { stdio: 'inherit', preferLocal: true });
            break;
        }
      }
    } catch (err: unknown) {
      console.log(chalk.red.bold('\n❌ Operation Aborted.'));
      if ((err as Error).message) {
        console.log(chalk.dim((err as Error).message));
      }
    }

    // Pause execution to allow user to review output before clearing
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: chalk.hex('#555555')('Press [ENTER] to return to the main dashboard...'),
        prefix: chalk.hex('#00FF41')('›'),
      },
    ]);
  }
})();
