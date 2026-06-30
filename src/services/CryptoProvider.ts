const webCrypto = typeof globalThis !== 'undefined' && globalThis.crypto;

async function jsRandomBytes(size: number): Promise<ArrayBuffer> {
  const uint8 = new Uint8Array(size);
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    (webCrypto as any).getRandomValues(uint8);
  } else {
    for (let i = 0; i < size; i++) uint8[i] = Math.floor(Math.random() * 256);
  }
  return uint8.buffer;
}

function hasSubtle(): boolean {
  try { return !!(webCrypto as any)?.subtle?.importKey; } catch { return false; }
}

const jsAesAvailable = hasSubtle();

async function jsAesEncrypt(plaintext: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
  const subtle = (webCrypto as any).subtle;
  const cryptoKey = await subtle.importKey('raw', key, { name: 'AES-GCM', length: 128 }, false, ['encrypt']);
  return subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
}

async function jsAesDecrypt(ciphertext: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
  const subtle = (webCrypto as any).subtle;
  const cryptoKey = await subtle.importKey('raw', key, { name: 'AES-GCM', length: 128 }, false, ['decrypt']);
  return subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
}

async function throwAesUnavailable(_plaintext: ArrayBuffer, _key: ArrayBuffer, _iv: ArrayBuffer): Promise<ArrayBuffer> {
  throw new Error('AES-GCM is not available in this environment (crypto.subtle required)');
}

const fallbackAES = jsAesAvailable
  ? { encrypt: jsAesEncrypt, decrypt: jsAesDecrypt }
  : { encrypt: throwAesUnavailable, decrypt: throwAesUnavailable };
const fallbackUtils = { randomBytes: jsRandomBytes };

let AES = fallbackAES;
let utils = fallbackUtils;

try {
  const crypto = require('react-native-simple-crypto');
  if (crypto.AES && crypto.utils) {
    AES = crypto.AES;
    utils = crypto.utils;
  }
} catch (e) {
  console.warn('[Crypto] native module failed to load, using JS fallback:', e);
}

export { AES, utils };
