import { runInteropBenchmark } from './scripts/cli/tests/interop.js';

async function main() {
  console.log("Starting Interop Benchmark Suite...");
  try {
    const results = await runInteropBenchmark(
      (engine, progress, result, current, total) => {
        if (result) {
          console.log(`\n==================================================`);
          console.log(`[${engine}] VALIDATION: ${result.status}`);
          console.log(`[${engine}] CASCADE SPEED: ${result.casca_us.toFixed(2)} us`);
          console.log(`[${engine}] CYCLES/BYTE: ${result.casca_cpb.toFixed(2)} CPB`);
          console.log(`[${engine}] OPS/SEC: ${result.ops_sec.toLocaleString('en-US', {maximumFractionDigits: 0})}`);
          console.log(`[${engine}] THROUGHPUT: ${result.throughput_mbps.toFixed(2)} MB/s`);
          console.log(`==================================================`);
        } else if (progress % 25 === 0 && progress !== 0 && progress !== 100) {
          console.log(`[${engine}] Progress: ${progress}% (${current}/${total})`);
        }
      },
      100, // 100 rounds
      false // No docker
    );
    console.log("\nALL INTEROP TESTS COMPLETED.");
  } catch (e) {
    console.error("Interop benchmark failed!", e);
    process.exit(1);
  }
}

main();
