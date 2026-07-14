export interface KeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export interface CryptoProvider {
  generateKeyPair(): Promise<KeyPair>
  encrypt(message: Uint8Array, key: Uint8Array, nonce?: Uint8Array): Promise<Uint8Array>
  decrypt(ciphertext: Uint8Array, key: Uint8Array, nonce?: Uint8Array): Promise<Uint8Array>
  encryptWithNonce(message: Uint8Array, key: Uint8Array): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }>
  encryptAAD(message: Uint8Array, aad: Uint8Array, key: Uint8Array): Promise<Uint8Array>
  decryptAAD(ciphertext: Uint8Array, aad: Uint8Array, key: Uint8Array): Promise<Uint8Array>
  generateNonce(): Promise<Uint8Array>
  deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array>
  sha256(data: Uint8Array): Promise<Uint8Array>
}
