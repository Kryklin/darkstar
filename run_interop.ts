import { runInteropBenchmark } from './scripts/cli/tests/interop.js';

runInteropBenchmark((engine, progress, result) => {
    console.log(engine, progress, result);
}, 10).then(console.log).catch(console.error);
