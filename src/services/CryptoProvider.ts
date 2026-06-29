function bytesToBase64(bytes: ArrayBuffer): string {
  const uint8 = new Uint8Array(bytes);
  let result = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < uint8.length; i += 3) {
    const a = uint8[i];
    const b = i + 1 < uint8.length ? uint8[i + 1] : 0;
    const c = i + 2 < uint8.length ? uint8[i + 2] : 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < uint8.length) result += chars[((b & 15) << 2) | (c >> 6)];
    else result += '=';
    if (i + 2 < uint8.length) result += chars[c & 63];
    else result += '=';
  }
  return result;
}

function base64ToBytes(b64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const sanitized = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = (sanitized.length * 3) / 4;
  const uint8 = new Uint8Array(len);
  let j = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const a = chars.indexOf(sanitized[i]);
    const b = chars.indexOf(sanitized[i + 1]);
    const c = chars.indexOf(sanitized[i + 2]);
    const d = chars.indexOf(sanitized[i + 3]);
    uint8[j++] = (a << 2) | (b >> 4);
    if (c !== -1) uint8[j++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1) uint8[j++] = ((c & 3) << 6) | d;
  }
  return uint8.buffer.slice(0, j);
}

function concatBuffers(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
  const result = new Uint8Array(a.byteLength + b.byteLength);
  result.set(new Uint8Array(a), 0);
  result.set(new Uint8Array(b), a.byteLength);
  return result.buffer;
}

async function jsRandomBytes(size: number): Promise<ArrayBuffer> {
  const uint8 = new Uint8Array(size);
  globalThis.crypto.getRandomValues(uint8);
  return uint8.buffer;
}

async function jsAesEncrypt(plaintext: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM', length: 128 }, false, ['encrypt'],
  );
  return globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
}

async function jsAesDecrypt(ciphertext: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM', length: 128 }, false, ['decrypt'],
  );
  return globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
}

const fallbackAES = { encrypt: jsAesEncrypt, decrypt: jsAesDecrypt };
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

export { AES, utils, bytesToBase64, base64ToBytes, concatBuffers };
