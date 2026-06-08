import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const C_BIN = path.join(__dirname, '../../rust/target/release/d-asp.exe');
const C_CWD = path.join(__dirname, '../../rust');
const DATA_DIR = path.join(__dirname, '../data');

async function runEngine(args: string[]) {
  const res = await execa(C_BIN, args, { cwd: C_CWD, reject: false, timeout: 60000 });
  if (res.exitCode !== 0) {
    console.error(`ERROR: ${res.stderr}`);
    throw new Error(`Engine returned ${res.exitCode}`);
  }
  let out = res.stdout;
  if (out.endsWith('\n')) out = out.slice(0, -1);
  if (out.endsWith('\r')) out = out.slice(0, -1);
  return { out, err: res.stderr };
}

(async () => {
  console.log("Generating Master KAT Key using Rust Reference Engine...");
  const { out: keygenOut } = await runEngine(["keygen"]);
  
  const lines = keygenOut.split('\n').map(l => l.trim());
  const pk = lines[0].split(": ")[1];
  const sk = lines[1].split(": ")[1];
  
  if (!pk || !sk) {
    throw new Error(`Failed to find PK/SK in keygen output:\n${keygenOut}`);
  }
  
  console.log(`PK length: ${pk.length / 2} bytes, SK length: ${sk.length / 2} bytes`);
  
  const vectors: any[] = [];
  
  const testCases = [
    { id: "V1_STD", payload: "Darkstar Professional Grade KAT Vector 001", hwid: null },
    { id: "V2_IDB", payload: "Darkstar Identity Bound KAT Vector 002", hwid: "00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF" },
    { id: "V3_LNG", payload: "Long KAT Payload: " + ("ABCDEF ".repeat(20)).trim(), hwid: "FFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100" }
  ];
  
  for (const tc of testCases) {
    console.log(`Generating Vector ${tc.id} using Rust engine encrypt...`);
    
    const pkFile = path.join(C_CWD, "tmp_pk.hex");
    await fs.writeFile(pkFile, pk, 'utf-8');
    
    const args = ["--diagnostic", "encrypt", tc.payload, `@${pkFile}`, "--telemetry"];
    let hwidFile = "";
    if (tc.hwid) {
      hwidFile = path.join(C_CWD, "tmp_hwid.hex");
      await fs.writeFile(hwidFile, tc.hwid, 'utf-8');
      args.push("--hwid", `@${hwidFile}`);
    }
    
    const { out: encJsonRaw, err: diagRaw } = await runEngine(args);
    
    const outputLines = encJsonRaw.split('\n').filter(l => !l.startsWith('{"diagnostics"'));
    const finalEncJsonRaw = outputLines.length ? outputLines[outputLines.length - 1].trim() : encJsonRaw;
    const encJson = JSON.parse(finalEncJsonRaw);
    
    let diagnostics = {};
    for (const line of diagRaw.split('\n')) {
      try {
        const dObj = JSON.parse(line);
        if (dObj.diagnostics) {
          diagnostics = dObj.diagnostics;
          break;
        }
      } catch (e) { }
    }
    
    vectors.push({
      vector_id: tc.id,
      pk,
      sk,
      hwid: tc.hwid,
      payload: tc.payload,
      ciphertext_json: encJson,
      diagnostics
    });
    
    await fs.rm(pkFile, { force: true });
    if (hwidFile) await fs.rm(hwidFile, { force: true });
  }
  
  await fs.mkdir(DATA_DIR, { recursive: true });
  const outputPath = path.join(DATA_DIR, "kat_vectors.json");
  await fs.writeFile(outputPath, JSON.stringify(vectors, null, 2), 'utf-8');
  
  console.log(`\nSuccessfully generated ${vectors.length} vectors in ${outputPath}`);
  console.log("NOTE: KAT vectors use Rust-native ML-KEM-1024 keypair + Rust encrypt.");
  console.log("All engines decrypt to validate SPNA cascade parity.");
})();
