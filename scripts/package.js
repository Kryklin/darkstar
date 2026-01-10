const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

(async () => {
  // Dynamic imports for ESM packages
  const { default: ora } = await import('ora');
  const { default: chalk } = await import('chalk');
  const { default: inquirer } = await import('inquirer');
  const { execa } = await import('execa');

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

    new inquirer.Separator(chalk.dim('--- Release ---')),
    { name: chalk.yellow('  🏗️   Build Production'), value: 'build' },
    { name: chalk.hex('#FFA500')('  📦  Package Application'), value: 'package' },
    { name: chalk.green('  🚀  Publish Release'), value: 'publish' },

    new inquirer.Separator(chalk.dim('--- Pipelines ---')),
    { name: chalk.bold.white('  ⚡  Run All (Lint -> Test -> Build -> Package -> Publish)'), value: 'all' },

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
      // Build: Compiles Angular (Production) and Electron (TypeScript)
      BUILD: 'ng build --configuration production --base-href ./ && tsc --p tsconfig.electron.json',
      // Dev: Runs Angular Serve and Electron Watch (via Wrapper) concurrently
      DEV: 'concurrently -k --success first "ng serve" "wait-on http://localhost:4200 && node scripts/dev-wrapper.js"',
      // Package: Packages the Electron app using Forge
      PACKAGE: 'electron-forge package',
      // Publish: Publishes the Electron app using Forge
      PUBLISH: 'electron-forge publish',
    };

    // Execute selected action
    if (action === 'all') {
      console.log(chalk.bold.underline('\n🚀 Starting Full Release Pipeline\n'));
      await runShell('Linting', CMD.LINT);
      await new Promise((r) => setTimeout(r, 2000));
      await runShell('Testing', CMD.TEST);
      await new Promise((r) => setTimeout(r, 2000));
      await runShell('Building', CMD.BUILD);
      await new Promise((r) => setTimeout(r, 2000));

      // Use { clear: false } to preserve build output context
      console.log(chalk.yellow('ℹ Packaging Application...'));
      await runShell('Packaging', CMD.PACKAGE, { clear: false });

      // Ask for publish confirmation even in "run all" to avoid accidental releases
      console.log(chalk.yellow('\nPipeline requires confirmation to Publish:'));
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.red('⚠️  Do you want to PUBLISH this release now?'),
          default: false,
          prefix: '',
        },
      ]);

      if (confirm) {
        await runShell('Publishing', CMD.PUBLISH, { clear: false });
      } else {
        console.log(chalk.yellow('Publishing skipped.'));
      }

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
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: chalk.red('⚠️  Are you sure you want to PUBLISH this release?'),
              default: false,
            },
          ]);
          if (confirm) {
            console.log(chalk.yellow('ℹ Building before publishing...'));
            await runShell('Building', CMD.BUILD);
            // Preserve build log
            await runShell('Publishing', CMD.PUBLISH, { clear: false });
          } else {
            console.log(chalk.yellow('Publishing cancelled.'));
          }
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
