function throwNotLoaded(name: string): any {
  throw new Error(`react-native-simple-crypto not loaded: ${name} is unavailable`);
}

const fallbackAES = {
  encrypt: (..._args: any[]) => throwNotLoaded('AES.encrypt'),
  decrypt: (..._args: any[]) => throwNotLoaded('AES.decrypt'),
};

const fallbackUtils = {
  randomBytes: (..._args: any[]) => throwNotLoaded('utils.randomBytes'),
};

let AES: typeof fallbackAES = fallbackAES;
let utils: typeof fallbackUtils = fallbackUtils;

try {
  const crypto = require('react-native-simple-crypto');
  if (crypto.AES && crypto.utils) {
    AES = crypto.AES;
    utils = crypto.utils;
  }
} catch (e) {
  console.warn('[Crypto] native module failed to load, using fallback (will throw on crypto ops):', e);
}

export { AES, utils };
