import { DarkstarCrypt } from './darkstar_crypt.js';

async function run() {
  const crypt = new DarkstarCrypt();
  const mnemonic = 'cat dog fish bird';
  const password = 'MySecre!Password123';

  console.log(`Encrypting: '${mnemonic}' with password '${password}'`);
  const result = await crypt.encrypt(mnemonic, password);
  console.log('Encrypted Result:', result);

  console.log('Decrypting...');
  const decrypted = await crypt.decrypt(result.encryptedData, result.reverseKey, password);
  console.log(`Decrypted: '${decrypted}'`);

  if (decrypted !== mnemonic) {
    console.error('FAILED! mismatched.');
    process.exit(1);
  }
  console.log('Test Passed!');
}

run();
