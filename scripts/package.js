const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

(async () => {
  // Dynamic imports for ESM packages
  const { default: ora } = await import('ora');
  const { default: chalk } = await import('chalk');
  const { default: inquirer } = await import('inquirer');
  const { execa } = await import('execa');
  
  // Basic .env loader to support GitHub tokens without terminal restarts
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    });
  }

  /**
   * Clears the terminal and displays the project header.
   * Uses metadata from package.json for consistent branding.
   */
  function printHeader() {
    console.clear();
    const border = chalk.dim('='.repeat(60));
    console.log(border);
    console.log(chalk.bold.hex('#00ADD8')(`${pkg.productName.toUpperCase()}`));
    console.log(chalk.dim(`v${pkg.version}`));
    console.log(chalk.white(`${pkg.description}`));
    console.log(chalk.gray(`Author: ${pkg.author}`));
    console.log(border);
    console.log('');
  }

  // --- Menu Configuration ---
  const choices = [
    new inquirer.Separator(chalk.dim('--- Development ---')),
    { name: chalk.cyan('  💻  Run Dev Environment'), value: 'dev' },
    { name: chalk.blue('  🔍  Lint Code'), value: 'lint' },
    { name: chalk.magenta('  🧪  Run Tests (Headless & Interop)'), value: 'test' },

    new inquirer.Separator(chalk.dim('--- Mobile (Capacitor) ---')),
    { name: chalk.cyan('  📱  Sync Mobile Assets'), value: 'cap:sync' },
    { name: chalk.green('  🤖  Open Android Studio'), value: 'cap:open:android' },
    { name: chalk.blue('  🍏  Open Xcode'), value: 'cap:open:ios' },

    new inquirer.Separator(chalk.dim('--- Release ---')),
    { name: chalk.yellow('  🏗️   Build Production'), value: 'build' },
    { name: chalk.hex('#FFA500')('  📦  Package Application'), value: 'package' },
    { name: chalk.green('  🚀  Publish Release'), value: 'publish' },

    new inquirer.Separator(chalk.dim('--- Pipelines ---')),
    { name: chalk.bold.white('  ⚡  Run All (Lint -> Test -> Build -> Publish)'), value: 'all' },

    new inquirer.Separator(chalk.dim('--- System ---')),
    { name: chalk.red.bold('  ❌  Exit'), value: 'exit' },
  ];

  /**
   * Executes a shell command with a spinner and error handling.
   *
   * @param {string} stepName - Display name for the step (e.g. "Linting")
   * @param {string} command - Command to execute
   * @param {string[]} [args=[]] - Arguments for the command
   * @param {object} [options={}] - Extra options for execa
   */
  async function runStep(stepName, command, args = [], options = {}) {
    // Extract custom options from execa options
    const { clear = true, ...execaOptions } = options;

    if (clear) {
      printHeader(); // Refresh header for unified UI
    }

    const spinner = ora(chalk.blue(`Running ${stepName}...`)).start();
    try {
      spinner.stop(); // Stop spinner to stream output to console directly
      console.log(chalk.dim(`\n> Executing: ${command} ${args.join(' ')}\n`));

      // Execute command, inheriting stdio to show real-time output
      await execa(command, args, { stdio: 'inherit', preferLocal: true, ...execaOptions });

      console.log(chalk.green.bold(`\n✔ ${stepName} Completed Successfully!\n`));
    } catch (error) {
      console.log(chalk.red.bold(`\n✖ ${stepName} Failed!`));
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
  async function runShell(stepName, shellCommand, options = {}) {
    await runStep(stepName, shellCommand, [], { shell: true, ...options });
  }

  // --- Main Execution Loop ---
  while (true) {
    printHeader();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select an operation:',
        choices,
        prefix: chalk.cyan('?'),
      },
    ]);

    if (action === 'exit') {
      console.log(chalk.yellow('Goodbye! 👋'));
      process.exit(0);
    }

    /**
     * Command Definitions
     * Centralized configuration for all build/test/release commands.
     */
    const CMD = {
      LINT: 'ng lint',
      // Test: Runs headless Chrome tests and executes the Python interop verification script
      TEST: 'ng test --watch=false --browsers=ChromeHeadless && python "darkstar-encry/scripts/verify_interop.py"',
      // Build: Compiles Angular (Production) and Electron (TypeScript), then generates integrity
      BUILD: 'ng build --configuration production --base-href ./ && tsc --p tsconfig.electron.json && node scripts/build-integrity.js',
      // Dev: Runs Angular Serve and Electron Watch (via Wrapper) concurrently
      DEV: 'concurrently -k --success first "ng serve" "wait-on http://localhost:4200 && node scripts/dev-wrapper.js"',
      // Package: Packages the Electron app using Forge
      PACKAGE: 'electron-forge package',
      // Publish: Publishes the Electron app using Forge
      PUBLISH: 'electron-forge publish',
      // Mobile: Capacitor Commands
      CAP_SYNC: 'npx cap sync',
      CAP_OPEN_ANDROID: 'npx cap open android',
      CAP_OPEN_IOS: 'npx cap open ios',
    };

    // Execute selected action
    if (action === 'all') {
      console.log(chalk.bold.underline('\n🚀 Starting Full Release Pipeline\n'));
      await runShell('Linting', CMD.LINT);
      await new Promise((r) => setTimeout(r, 2000));
      await runShell('Testing', CMD.TEST);
      await new Promise((r) => setTimeout(r, 2000));
      await new Promise((r) => setTimeout(r, 2000));
      await runShell('Building', CMD.BUILD);
      await new Promise((r) => setTimeout(r, 2000));

      if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
        console.log(chalk.red.bold('\n⚠️  Error: GITHUB_TOKEN not found in environment.'));
        console.log(chalk.yellow('Publishing requires a GitHub Personal Access Token.'));
        console.log(chalk.yellow('Please create a .env file in the root directory with:'));
        console.log(chalk.cyan('GITHUB_TOKEN=your_token_here\n'));
        return;
      }

      await runShell('Publishing', CMD.PUBLISH, { clear: false });

      console.log(chalk.bold.green('\n✨ Full Release Pipeline Completed! ✨\n'));
    } else {
      switch (action) {
        case 'dev':
          await runShell('Dev Environment', CMD.DEV);
          break;
        case 'lint':
          await runShell('Linting', CMD.LINT);
          break;
        case 'test':
          await runShell('Testing', CMD.TEST);
          break;
        case 'cap:sync':
          console.log(chalk.yellow('ℹ Building core application before sync...'));
          await runShell('Building', CMD.BUILD);
          await runShell('Syncing Native Platforms', CMD.CAP_SYNC, { clear: false });
          break;
        case 'cap:open:android':
          await runShell('Opening Android Studio', CMD.CAP_OPEN_ANDROID);
          break;
        case 'cap:open:ios':
          await runShell('Opening Xcode', CMD.CAP_OPEN_IOS);
          break;
        case 'build':
          await runShell('Building', CMD.BUILD);
          break;
        case 'package':
          console.log(chalk.yellow('ℹ Building before packaging...'));
          await runShell('Building', CMD.BUILD);
          // Preserve build log
          await runShell('Packaging', CMD.PACKAGE, { clear: true }); // User requested clear back
          break;
        case 'publish':
          if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
            console.log(chalk.red.bold('\n⚠️  Error: GITHUB_TOKEN not found in environment.'));
            console.log(chalk.yellow('Please create a .env file in the root directory with:'));
            console.log(chalk.cyan('GITHUB_TOKEN=your_token_here\n'));
            break;
          }
          console.log(chalk.yellow('ℹ Building before publishing...'));
          await runShell('Building', CMD.BUILD);
          // Preserve build log
          await runShell('Publishing', CMD.PUBLISH, { clear: false });
          break;
      }
    }

    // Pause execution to allow user to review output before clearing
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: chalk.dim('Press Enter to return to the main menu...'),
        prefix: '',
      },
    ]);
  }
})();
