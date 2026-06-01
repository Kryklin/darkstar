const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building TypeScript...');
execSync('npx tsc', { stdio: 'inherit' });

const srcWasm = path.join(__dirname, '..', 'wasm', 'dasp_crypto.wasm');
const dockerWasm = path.join(__dirname, 'wasm', 'dasp_crypto.wasm');
const destWasm = path.join(__dirname, 'dist', 'dasp_crypto.wasm');

if (fs.existsSync(srcWasm)) {
  fs.copyFileSync(srcWasm, destWasm);
  console.log('Copied wasm from parent dir.');
} else if (fs.existsSync(dockerWasm)) {
  fs.copyFileSync(dockerWasm, destWasm);
  console.log('Copied wasm from local dir.');
} else {
  console.warn('Warning: WASM file not found! Skipping copy.');
}

console.log('Obfuscating JavaScript output...');
const JavaScriptObfuscator = require('javascript-obfuscator');
const mainJsPath = path.join(__dirname, 'dist', 'main.js');

if (fs.existsSync(mainJsPath)) {
  const code = fs.readFileSync(mainJsPath, 'utf8');
  const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    stringArray: true,
    stringArrayEncoding: ['base64'],
  });
  fs.writeFileSync(mainJsPath, obfuscationResult.getObfuscatedCode());
  console.log('Obfuscation complete.');
} else {
  console.warn('Warning: dist/main.js not found for obfuscation.');
}
