import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ml_kem1024: kyber } = require('@noble/post-quantum/ml-kem.js');
console.log(Object.keys(kyber));
