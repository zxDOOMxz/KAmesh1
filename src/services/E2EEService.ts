import { AES, utils } from './CryptoProvider';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { getJson, setJson, getKeyBundle } from './StorageService';
import { x25519, ed25519 } from '@noble/curves/ed25519';

const KEY_LENGTH = 32;
const SALT_LENGTH = 32;

interface ChatE2EState {
  chatKey: string;
  sendCounter: number;
  recvCounters: Record<string, number>;
  memberKeys: Record<string, string>;
  createdAt: number;
}

class E2EEServiceClass {
  private chatStates = new Map<string, ChatE2EState>();

  initialize(): void {
    const stored = getJson<Record<string, ChatE2EState>>('e2ee_chat_states');
    if (stored) {
      for (const [chatId, state] of Object.entries(stored)) {
        this.chatStates.set(chatId, state);
      }
    }
  }

  private save(): void {
    const obj: Record<string, ChatE2EState> = {};
    for (const [chatId, state] of this.chatStates) {
      obj[chatId] = state;
    }
    setJson('e2ee_chat_states', obj);
  }

  getMyPublicKey(): string | null {
    try {
      const raw = getKeyBundle();
      if (!raw) return null;
      const bundle = JSON.parse(raw);
      return bundle.identityKey || null;
    } catch { return null; }
  }

  private getMyPrivateKey(): Uint8Array | null {
    try {
      const raw = getKeyBundle();
      if (!raw) return null;
      const bundle = JSON.parse(raw);
      return buf2ui8(base64ToBytes(bundle.identityPrivateKey));
    } catch { return null; }
  }

  signData(data: string): string {
    const privKey = this.getMyPrivateKey();
    if (!privKey) throw new Error('KeyBundle not found');
    const sig = ed25519.sign(new TextEncoder().encode(data), privKey);
    return bytesToBase64(sig);
  }

  verifySignature(data: string, signature: string, pubKeyB64: string): boolean {
    try {
      return ed25519.verify(
        buf2ui8(base64ToBytes(signature)),
        new TextEncoder().encode(data),
        buf2ui8(base64ToBytes(pubKeyB64)),
      );
    } catch { return false; }
  }

  // Setup shared chat key using X3DH with all members
  async setupChatKey(chatId: string, memberPublicKeys: string[]): Promise<void> {
    if (this.chatStates.has(chatId)) return;

    const myPriv = this.getMyPrivateKey();
    if (!myPriv) throw new Error('Own key not found');

    // Generate random chat key (256-bit)
    const chatKeyRaw = new Uint8Array(await utils.randomBytes(KEY_LENGTH));

    // Encrypt chat key for each member using X3DH shared secret
    const memberKeys: Record<string, string> = {};
    for (const pubKeyB64 of memberPublicKeys) {
      if (!pubKeyB64) continue;
      const pubKey = buf2ui8(base64ToBytes(pubKeyB64));
      const sharedSecret = x25519.getSharedSecret(myPriv, pubKey);
      const derivedKey = hkdf(sha256, sharedSecret, new Uint8Array(SALT_LENGTH), new TextEncoder().encode('sofilink-e2ee-chatkey'), KEY_LENGTH);
      const iv = new Uint8Array(await utils.randomBytes(12));
      const encrypted = new Uint8Array(await AES.encrypt(chatKeyRaw, derivedKey, iv));
      memberKeys[pubKeyB64] = bytesToBase64(concatBuffers([iv.buffer, encrypted.buffer]));
    }

    const state: ChatE2EState = {
      chatKey: bytesToBase64(chatKeyRaw.buffer),
      sendCounter: 0,
      recvCounters: {},
      memberKeys,
      createdAt: Date.now(),
    };
    this.chatStates.set(chatId, state);
    this.save();
  }

  // Get encrypted chat key for a member
  getEncryptedChatKeyForMember(chatId: string, memberPubKey: string): string | null {
    const state = this.chatStates.get(chatId);
    if (!state) return null;
    return state.memberKeys[memberPubKey] || null;
  }

  // Decrypt and apply chat key from a received key bundle
  async receiveChatKey(chatId: string, encryptedKeyB64: string, senderPubKeyB64: string): Promise<void> {
    if (this.chatStates.has(chatId)) return;

    const myPriv = this.getMyPrivateKey();
    if (!myPriv) throw new Error('Own key not found');

    const senderPubKey = buf2ui8(base64ToBytes(senderPubKeyB64));
    const sharedSecret = x25519.getSharedSecret(myPriv, senderPubKey);
    const derivedKey = hkdf(sha256, sharedSecret, new Uint8Array(SALT_LENGTH), new TextEncoder().encode('sofilink-e2ee-chatkey'), KEY_LENGTH);

    const data = buf2ui8(base64ToBytes(encryptedKeyB64));
    const iv = data.subarray(0, 12);
    const ciphertext = data.subarray(12);
    const chatKeyRaw = new Uint8Array(await AES.decrypt(ciphertext, derivedKey, iv));

    const state: ChatE2EState = {
      chatKey: bytesToBase64(chatKeyRaw.buffer),
      sendCounter: 0,
      recvCounters: {},
      memberKeys: {},
      createdAt: Date.now(),
    };
    this.chatStates.set(chatId, state);
    this.save();
  }

  // Encrypt message: derive per-message key via symmetric ratchet → AES-256-GCM
  async encryptMessage(chatId: string, plaintext: string): Promise<string> {
    const state = this.chatStates.get(chatId);
    if (!state) throw new Error(`Chat ${chatId} not initialized for E2EE`);

    const chatKeyBytes = buf2ui8(base64ToBytes(state.chatKey));
    const counter = state.sendCounter;
    state.sendCounter += 1;
    this.save();

    // Per-message key: HKDF(chatKey, counter, "sofilink-msg-key")
    const counterBytes = new Uint8Array(8);
    new DataView(counterBytes.buffer).setBigUint64(0, BigInt(counter), false);
    const msgKey = hkdf(sha256, chatKeyBytes, counterBytes, new TextEncoder().encode('sofilink-msg-key'), KEY_LENGTH);

    // AES-256-GCM
    const iv = new Uint8Array(await utils.randomBytes(12));
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const encrypted = new Uint8Array(await AES.encrypt(plaintextBytes, msgKey, iv));

    // Output: counter (8 bytes) + iv (12 bytes) + ciphertext
    const output = new Uint8Array(8 + iv.length + encrypted.length);
    new DataView(output.buffer).setBigUint64(0, BigInt(counter), false);
    output.set(iv, 8);
    output.set(encrypted, 8 + iv.length);

    return bytesToBase64(output.buffer);
  }

  // Decrypt message
  async decryptMessage(chatId: string, cipherB64: string, senderPubKeyB64?: string): Promise<string> {
    const state = this.chatStates.get(chatId);
    if (!state) throw new Error(`Chat ${chatId} not initialized for E2EE`);

    const data = buf2ui8(base64ToBytes(cipherB64));
    const counter = Number(new DataView(data.buffer, data.byteOffset, 8).getBigUint64(0, false));
    const iv = data.subarray(8, 20);
    const ciphertext = data.subarray(20);

    const senderId = senderPubKeyB64 || 'default';
    let recvCounter = state.recvCounters[senderId] ?? 0;

    if (counter < recvCounter && recvCounter - counter > 100) {
      throw new Error(`Message counter too old: ${counter} < ${recvCounter}`);
    }
    if (counter >= recvCounter) {
      state.recvCounters[senderId] = counter + 1;
      this.save();
    }

    const chatKeyBytes = buf2ui8(base64ToBytes(state.chatKey));
    const counterBytes = new Uint8Array(8);
    new DataView(counterBytes.buffer).setBigUint64(0, BigInt(counter), false);
    const msgKey = hkdf(sha256, chatKeyBytes, counterBytes, new TextEncoder().encode('sofilink-msg-key'), KEY_LENGTH);

    const decrypted = await AES.decrypt(ciphertext, msgKey, iv);
    return new TextDecoder().decode(decrypted);
  }

  hasChatKey(chatId: string): boolean {
    return this.chatStates.has(chatId);
  }

  removeChatKey(chatId: string): void {
    this.chatStates.delete(chatId);
    this.save();
  }
}

function buf2ui8(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf);
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const uint8 = new Uint8Array(bytes);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < uint8.length; i += 3) {
    const a = uint8[i], b = i + 1 < uint8.length ? uint8[i + 1] : 0, c = i + 2 < uint8.length ? uint8[i + 2] : 0;
    result += chars[a >> 2] + chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < uint8.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < uint8.length ? chars[c & 63] : '=';
  }
  return result;
}

function base64ToBytes(b64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const sanitized = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((sanitized.length * 3) / 4);
  const uint8 = new Uint8Array(len);
  let j = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const a = chars.indexOf(sanitized[i]), b = chars.indexOf(sanitized[i + 1]);
    const c = chars.indexOf(sanitized[i + 2]), d = chars.indexOf(sanitized[i + 3]);
    uint8[j++] = (a << 2) | (b >> 4);
    if (c !== -1) uint8[j++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1) uint8[j++] = ((c & 3) << 6) | d;
  }
  return uint8.buffer.slice(0, j);
}

function concatBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLen = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}

export const E2EEService = new E2EEServiceClass();
