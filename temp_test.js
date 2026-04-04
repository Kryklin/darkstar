import { DarkstarCrypt } from './d-kasp-512/node/darkstar_crypt.js';

const dc = new DarkstarCrypt();
const mnemonic = "apple banana";
const password = "test";

async function test() {
    try {
        const resObj = await dc.encrypt(mnemonic, password); // Defaults to V4 in modern suite
        console.log("ENCRYPTED V4 SUCCESS");

        const dec = await dc.decrypt(resObj.encryptedData, resObj.reverseKey, password);
        console.log(`DECRYPTED V4: '${dec}'`);

        if (dec === mnemonic) {
            console.log("NODE.JS V4 SELF-TEST PASSED");
        } else {
            console.log(`NODE.JS V4 SELF-TEST FAILED. '${dec}' !== '${mnemonic}'`);
        }
    } catch (e) {
        console.error("NODE.JS V4 SELF-TEST ERROR:", e);
    }
}

test();
