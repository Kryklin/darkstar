import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as https from 'https';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');

(async () => {
  const { execa } = await import('execa');
  const { default: ora } = await import('ora');
  const { default: chalk } = await import('chalk');

  // Basic .env loader
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

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.log(chalk.red.bold('\n⚠️ Error: GITHUB_TOKEN not found in environment.'));
    console.log(chalk.yellow('Publishing requires a GitHub Personal Access Token.'));
    console.log(chalk.yellow('Please create a .env file in the root directory with:'));
    console.log(chalk.cyan('GITHUB_TOKEN=your_token_here\n'));
    process.exit(1);
  }

  const outDir = path.join(__dirname, '../../out-releases');
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const root = path.join(__dirname, '../..');

  const engines = [
    { name: 'rust-engine-windows-x64.zip', cwd: 'rust/target/release', files: ['d-asp.exe'] },
    { name: 'c-engine-windows-x64.zip', cwd: 'c', files: ['dasp.exe', 'dasp_kem.dll', 'dasp.lib'] },
    { name: 'cuda-engine-windows-x64.zip', cwd: 'cuda', files: ['d-asp_cuda.exe', 'd-asp_cuda.lib', 'd-asp_cuda.exp'] },
    { name: 'wasm-engine-windows-x64.zip', cwd: 'wasm', files: ['dasp_crypto.wasm'] }
  ];

  console.log(chalk.cyan(`\n📦 Packaging ${engines.length} engines into ${outDir}...\n`));

  for (const engine of engines) {
    const spinner = ora(`Packaging ${engine.name}...`).start();
    try {
      const zipPath = path.join(outDir, engine.name);
      // Constructing tar command for archiving
      const existingFiles = [];
      for (const file of engine.files) {
        if (fs.existsSync(path.join(root, engine.cwd, file))) {
          existingFiles.push(file);
        }
      }
      if (existingFiles.length === 0) {
        spinner.fail(`Skipped ${engine.name} - No artifacts found in ${engine.cwd}`);
        continue;
      }

      await execa('tar.exe', ['-a', '-c', '-f', zipPath, ...existingFiles], { cwd: path.join(root, engine.cwd) });
      spinner.succeed(`Created ${engine.name}`);
    } catch (err: unknown) {
      spinner.fail(`Failed to package ${engine.name}`);
      console.error(err);
    }
  }

  console.log(chalk.cyan(`\n🚀 Uploading assets to GitHub Releases (v${pkg.version})...\n`));

  // Extract owner and repo from package.json
  const repoUrl = pkg.repository.url;
  const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!repoMatch) {
    console.error(chalk.red('Failed to parse GitHub repository URL from package.json.'));
    process.exit(1);
  }
  const owner = repoMatch[1];
  const repo = repoMatch[2];

  const githubApi = async (method: string, endpoint: string, body?: any, host = 'api.github.com') => {
    return new Promise<any>((resolve, reject) => {
      const req = https.request(
        {
          hostname: host,
          port: 443,
          path: endpoint,
          method: method,
          headers: {
            Authorization: `token ${token}`,
            'User-Agent': 'Darkstar-Publisher',
            Accept: 'application/vnd.github.v3+json',
            ...(body && host === 'api.github.com' ? { 'Content-Type': 'application/json' } : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data ? JSON.parse(data) : null);
            } else {
              reject(new Error(`API Error ${res.statusCode}: ${data}`));
            }
          });
        },
      );
      req.on('error', reject);
      if (body && host === 'api.github.com') {
        req.write(JSON.stringify(body));
      } else if (body && host === 'uploads.github.com') {
        req.setHeader('Content-Type', 'application/zip');
        req.setHeader('Content-Length', body.length);
        req.write(body);
      }
      req.end();
    });
  };

  try {
    const spinner = ora('Checking for existing release...').start();
    let releaseId;
    let uploadUrlStr;

    // Check if release exists
    try {
      const rel = await githubApi('GET', `/repos/${owner}/${repo}/releases/tags/v${pkg.version}`);
      releaseId = rel.id;
      uploadUrlStr = rel.upload_url;
      spinner.info(`Found existing release v${pkg.version}`);
    } catch (e) {
      spinner.text = 'Creating new release...';
      const rel = await githubApi('POST', `/repos/${owner}/${repo}/releases`, {
        tag_name: `v${pkg.version}`,
        name: `D-ASP v${pkg.version}`,
        body: `Automated release for D-ASP Core Engines v${pkg.version}.`,
        draft: false,
      });
      releaseId = rel.id;
      uploadUrlStr = rel.upload_url;
      spinner.succeed(`Created release v${pkg.version}`);
    }

    // Upload assets
    const uploadUrlBase = uploadUrlStr.split('{')[0]; // Remove URI template

    const zipFiles = fs.readdirSync(outDir).filter((f: string) => f.endsWith('.zip'));
    for (const file of zipFiles) {
      const upSpinner = ora(`Uploading ${file}...`).start();
      const filePath = path.join(outDir, file);
      const fileData = fs.readFileSync(filePath);
      try {
        await githubApi('POST', `${uploadUrlBase.replace('https://uploads.github.com', '')}?name=${file}`, fileData, 'uploads.github.com');
        upSpinner.succeed(`Uploaded ${file}`);
      } catch (e: any) {
        if (e.message.includes('already_exists')) {
          upSpinner.warn(`Skipped ${file} (already exists)`);
        } else {
          upSpinner.fail(`Failed to upload ${file}: ${e.message}`);
        }
      }
    }
    console.log(chalk.green.bold('\n✨ All engine packages successfully uploaded to GitHub Releases! ✨\n'));
  } catch (err: unknown) {
    console.error(chalk.red.bold('\n❌ Failed to publish release:'));
    console.error(err);
  }
})();
