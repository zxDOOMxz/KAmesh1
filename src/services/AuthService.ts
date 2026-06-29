import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { AES, utils } from './CryptoProvider';
import { getJson, setJson, containsKey, deleteKey, getKeyBundle, setKeyBundle } from './StorageService';

const PIN_HASH_KEY = 'pin_hash';
const PIN_SALT_KEY = 'pin_salt';
const ENCRYPTED_BUNDLE_KEY = 'encrypted_key_bundle';

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

function stringToBytes(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

function bytesToString(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

function generateSalt(): string {
  const salt = new Uint8Array(16);
  for (let i = 0; i < 16; i++) salt[i] = Math.floor(Math.random() * 256);
  return bytesToBase64(salt);
}

function hashPin(pin: string, salt: string): string {
  const combined = new TextEncoder().encode(pin + salt);
  return bytesToBase64(sha256(combined));
}

async function deriveEncryptionKey(pin: string, salt: string): Promise<ArrayBuffer> {
  const ikm = new TextEncoder().encode(pin);
  const info = new TextEncoder().encode('sofilinkPINv1');
  const key = hkdf(sha256, ikm, new TextEncoder().encode(salt), info, 16);
  return key.buffer;
}

class AuthServiceClass {
  isPinSet(): boolean {
    return containsKey(PIN_HASH_KEY);
  }

  async setPin(pin: string): Promise<void> {
    const salt = generateSalt();
    const hash = hashPin(pin, salt);
    setJson(PIN_HASH_KEY, hash);
    setJson(PIN_SALT_KEY, salt);
    await this.encryptKeyBundle(pin, salt);
  }

  verifyPin(pin: string): boolean {
    const storedHash = getJson<string>(PIN_HASH_KEY);
    const salt = getJson<string>(PIN_SALT_KEY);
    if (!storedHash || !salt) return false;
    return hashPin(pin, salt) === storedHash;
  }

  private async encryptKeyBundle(pin: string, salt: string): Promise<void> {
    try {
      const bundleJson = getKeyBundle();
      if (!bundleJson) return;
      const key = await deriveEncryptionKey(pin, salt);
      const iv = await utils.randomBytes(12);
      const encrypted = await AES.encrypt(stringToBytes(bundleJson), key, iv);
      const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
      combined.set(new Uint8Array(iv), 0);
      combined.set(new Uint8Array(encrypted), iv.byteLength);
      setJson(ENCRYPTED_BUNDLE_KEY, bytesToBase64(combined.buffer));
      deleteKey('key_bundle');
    } catch { /* keep original bundle if encryption fails */ }
  }

  async decryptKeyBundle(pin: string): Promise<boolean> {
    try {
      const salt = getJson<string>(PIN_SALT_KEY);
      const encryptedB64 = getJson<string>(ENCRYPTED_BUNDLE_KEY);
      if (!salt || !encryptedB64) return false;
      const key = await deriveEncryptionKey(pin, salt);
      const combined = new Uint8Array(base64ToBytes(encryptedB64));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await AES.decrypt(ciphertext, key, iv);
      setKeyBundle(bytesToString(decrypted));
      return true;
    } catch { return false; }
  }

  async changePin(oldPin: string, newPin: string): Promise<boolean> {
    if (!this.verifyPin(oldPin)) return false;
    await this.setPin(newPin);
    return true;
  }

  resetPin(): void {
    deleteKey(PIN_HASH_KEY);
    deleteKey(PIN_SALT_KEY);
    deleteKey(ENCRYPTED_BUNDLE_KEY);
  }
}

export const AuthService = new AuthServiceClass();
