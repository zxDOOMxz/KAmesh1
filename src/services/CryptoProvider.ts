let AES: any = {};
let utils: any = {};

try {
  const crypto = require('react-native-simple-crypto');
  AES = crypto.AES;
  utils = crypto.utils;
} catch (e) {
  console.warn('[Crypto] native module failed to load:', e);
}

export { AES, utils };
