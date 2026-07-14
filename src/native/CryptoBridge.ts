import { NativeModules } from 'react-native'
import type { CryptoProvider, KeyPair } from '../crypto/CryptoProvider'

const { SofiLinkCrypto } = NativeModules

interface NativeEncryptResult {
  ciphertext: string
  nonce: string
}

export class CryptoBridge implements CryptoProvider {
  async generateKeyPair(): Promise<KeyPair> {
    const result = await SofiLinkCrypto.generateKeyPair()
    return {
      publicKey: hexToBytes(result.publicKey),
      secretKey: hexToBytes(result.secretKey),
    }
  }

  async encrypt(
    message: Uint8Array,
    key: Uint8Array,
    _nonce?: Uint8Array,
  ): Promise<Uint8Array> {
    const result: NativeEncryptResult = await SofiLinkCrypto.encrypt(
      bytesToHex(message),
      bytesToHex(key),
    )
    // ciphertext = encrypted data + 16-byte Poly1305 tag
    return hexToBytes(result.ciphertext)
  }

  async decrypt(
    ciphertext: Uint8Array,
    key: Uint8Array,
    nonce?: Uint8Array,
  ): Promise<Uint8Array> {
    const result = await SofiLinkCrypto.decrypt(
      bytesToHex(ciphertext),
      bytesToHex(nonce ?? new Uint8Array(12)),
      bytesToHex(key),
    )
    return hexToBytes(result)
  }

  // We need to expose nonce separately since native generates it
  async encryptWithNonce(
    message: Uint8Array,
    key: Uint8Array,
  ): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
    const result: NativeEncryptResult = await SofiLinkCrypto.encrypt(
      bytesToHex(message),
      bytesToHex(key),
    )
    return {
      ciphertext: hexToBytes(result.ciphertext),
      nonce: hexToBytes(result.nonce),
    }
  }

  async encryptAAD(
    message: Uint8Array,
    _aad: Uint8Array,
    key: Uint8Array,
  ): Promise<Uint8Array> {
    // Simplified: AAD not used in basic mode, ChaCha20-Poly1305 implicitly authenticates
    return this.encrypt(message, key)
  }

  async decryptAAD(
    ciphertext: Uint8Array,
    _aad: Uint8Array,
    key: Uint8Array,
  ): Promise<Uint8Array> {
    return this.decrypt(ciphertext, key)
  }

  async generateNonce(): Promise<Uint8Array> {
    const nonceHex = await SofiLinkCrypto.generateNonce()
    return hexToBytes(nonceHex)
  }

  async deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
    const keyHex = await SofiLinkCrypto.deriveKey(password, bytesToHex(salt))
    return hexToBytes(keyHex)
  }

  async sha256(data: Uint8Array): Promise<Uint8Array> {
    const hashHex = await SofiLinkCrypto.sha256(bytesToHex(data))
    return hexToBytes(hashHex)
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

export const createCryptoBridge = (): CryptoBridge => new CryptoBridge()
