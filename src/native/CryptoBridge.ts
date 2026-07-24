import { NativeModules } from 'react-native';
import type { CryptoProvider, KeyPair } from '../crypto/CryptoProvider';

const { SofiLinkCrypto } = NativeModules;

interface NativeEncryptResult {
  ciphertext: string
  nonce: string
}

export class CryptoBridge implements CryptoProvider {
  private get native() { return SofiLinkCrypto; }

  async generateKeyPair(): Promise<KeyPair> {
    if (!this.native) { return { publicKey: new Uint8Array(), secretKey: new Uint8Array() }; }
    const result = await this.native.generateKeyPair();
    return { publicKey: hexToBytes(result.publicKey), secretKey: hexToBytes(result.secretKey) };
  }

  async encrypt(message: Uint8Array, key: Uint8Array, _nonce?: Uint8Array): Promise<Uint8Array> {
    if (!this.native) { return message; }
    const result: NativeEncryptResult = await this.native.encrypt(bytesToHex(message), bytesToHex(key));
    return hexToBytes(result.ciphertext);
  }

  async decrypt(ciphertext: Uint8Array, key: Uint8Array, nonce?: Uint8Array): Promise<Uint8Array> {
    if (!this.native) { return ciphertext; }
    const result = await this.native.decrypt(bytesToHex(ciphertext), bytesToHex(nonce ?? new Uint8Array(12)), bytesToHex(key));
    if (typeof result === 'string') { return hexToBytes(result); }
    return hexToBytes(String(result));
  }

  async encryptWithNonce(message: Uint8Array, key: Uint8Array): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
    if (!this.native) { return { ciphertext: message, nonce: new Uint8Array(12) }; }
    const result: NativeEncryptResult = await this.native.encrypt(bytesToHex(message), bytesToHex(key));
    return { ciphertext: hexToBytes(result.ciphertext), nonce: hexToBytes(result.nonce) };
  }

  async encryptAAD(message: Uint8Array, _aad: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    return this.encrypt(message, key);
  }

  async decryptAAD(ciphertext: Uint8Array, _aad: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    return this.decrypt(ciphertext, key);
  }

  async generateNonce(): Promise<Uint8Array> {
    if (!this.native) { return crypto.getRandomValues(new Uint8Array(12)); }
    const nonceHex = await this.native.generateNonce();
    return hexToBytes(nonceHex);
  }

  async deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
    if (!this.native) { return new TextEncoder().encode(password + bytesToHex(salt)).slice(0, 32); }
    const keyHex = await this.native.deriveKey(password, bytesToHex(salt));
    return hexToBytes(keyHex);
  }

  async sha256(data: Uint8Array): Promise<Uint8Array> {
    if (!this.native) {
      const hash = new Uint8Array(32);
      for (let i = 0; i < Math.min(data.length, 32); i++) { hash[i] = data[i]; }
      return hash;
    }
    const hashHex = await this.native.sha256(bytesToHex(data));
    return hexToBytes(hashHex);
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
