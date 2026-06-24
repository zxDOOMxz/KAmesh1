import { x25519, ed25519 } from '@noble/curves/ed25519';
import { AES, utils } from 'react-native-simple-crypto';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { KeyBundle, KeySession, MeshPacket, MessageType, KeyExchangePayload } from '../types';
import { getKeyBundle, getKeySessions, saveKeySession, setKeyBundle } from './StorageService';

const KEY_LENGTH = 32;
const OPK_POOL_SIZE = 10;

export async function generateKeyBundle(): Promise<KeyBundle> {
  const identityPriv = ed25519.utils.randomPrivateKey();
  const identityPub = ed25519.getPublicKey(identityPriv);
  const signedPreKeyPriv = ed25519.utils.randomPrivateKey();
  const signedPreKeyPub = ed25519.getPublicKey(signedPreKeyPriv);
  const signature = ed25519.sign(signedPreKeyPub, identityPriv);
  const oneTimePreKeys: string[] = [];
  for (let i = 0; i < OPK_POOL_SIZE; i++) {
    const opk = ed25519.utils.randomPrivateKey();
    oneTimePreKeys.push(bytesToBase64(opk));
  }
  const bundle: KeyBundle = {
    identityKey: bytesToBase64(identityPub), identityPrivateKey: bytesToBase64(identityPriv),
    signedPreKey: bytesToBase64(signedPreKeyPub), signedPreKeyPrivate: bytesToBase64(signedPreKeyPriv),
    signature: bytesToBase64(signature),
    oneTimePreKeys,
  };
  setKeyBundle(JSON.stringify(bundle));
  return bundle;
}

function verifyEd25519(publicKey: ArrayBuffer, data: ArrayBuffer, signature: ArrayBuffer): boolean {
  try { return ed25519.verify(new Uint8Array(signature), new Uint8Array(data), new Uint8Array(publicKey)); }
  catch { return false; }
}

export async function performX3DH(peerBundle: KeyBundle, peerId: string): Promise<KeySession> {
  const myBundleJson = getKeyBundle();
  if (!myBundleJson) throw new Error('Own KeyBundle not found');

  const myBundle: KeyBundle = JSON.parse(myBundleJson);
  const myIdentityPriv = base64ToBytes(myBundle.identityPrivateKey);
  const mySignedPreKeyPriv = base64ToBytes(myBundle.signedPreKeyPrivate);
  const peerIdentityPub = base64ToBytes(peerBundle.identityKey);
  const peerSignedPreKeyPub = base64ToBytes(peerBundle.signedPreKey);

  const sigOk = verifyEd25519(peerIdentityPub, peerSignedPreKeyPub, base64ToBytes(peerBundle.signature));
  if (!sigOk) throw new Error('Peer SPK signature verification failed');

  const ephemeralPriv = x25519.utils.randomPrivateKey();
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);

  const dh1 = ecdh(myIdentityPriv, peerSignedPreKeyPub);
  const dh2 = ecdh(ephemeralPriv, peerIdentityPub);
  const dh3 = ecdh(ephemeralPriv, peerSignedPreKeyPub);

  let dh4: ArrayBuffer | null = null;
  let usedOpkIndex: number | undefined;
  let usedOpk: string | undefined;
  if (peerBundle.oneTimePreKeys.length > 0) {
    const peerOpk = base64ToBytes(peerBundle.oneTimePreKeys[0]);
    dh4 = ecdh(ephemeralPriv, peerOpk);
    usedOpkIndex = 0;
    usedOpk = peerBundle.oneTimePreKeys[0];
  }

  const sharedSecretBase = deriveSharedSecret(dh1, dh2, dh3, dh4, ephemeralPub);

  const rootKey = sharedSecretBase.slice(0, KEY_LENGTH);
  const sendKey = sharedSecretBase.slice(KEY_LENGTH, KEY_LENGTH * 2);
  const recvKey = sharedSecretBase.slice(KEY_LENGTH * 2);

  const session: KeySession = {
    peerId, rootKey: bytesToBase64(rootKey),
    sendKey: bytesToBase64(sendKey), recvKey: bytesToBase64(recvKey),
    sendCounter: 0, recvCounter: 0, createdAt: Date.now(),
  };
  saveKeySession(peerId, session);

  const exchangePayload: KeyExchangePayload = {
    identityKey: myBundle.identityKey,
    signedPreKey: myBundle.signedPreKey,
    signature: myBundle.signature,
    ephemeralPublicKey: bytesToBase64(ephemeralPub),
    peerId,
    opkIndex: usedOpkIndex,
    opk: usedOpk,
  };
  saveKeySession(peerId, { ...session, pendingExchange: exchangePayload });
  return session;
}

export async function performX3DHResponder(exchangePayload: KeyExchangePayload, peerId: string): Promise<KeySession> {
  const myBundleJson = getKeyBundle();
  if (!myBundleJson) throw new Error('Own KeyBundle not found');

  const myBundle: KeyBundle = JSON.parse(myBundleJson);
  const myIdentityPriv = base64ToBytes(myBundle.identityPrivateKey);
  const mySignedPreKeyPriv = base64ToBytes(myBundle.signedPreKeyPrivate);
  const initiatorIdentityPub = base64ToBytes(exchangePayload.identityKey);
  const initiatorEphemeralPub = new Uint8Array(base64ToBytes(exchangePayload.ephemeralPublicKey));

  const sigOk = verifyEd25519(initiatorIdentityPub, base64ToBytes(exchangePayload.signedPreKey), base64ToBytes(exchangePayload.signature));
  if (!sigOk) throw new Error('Initiator SPK signature verification failed');

  const dh1 = ecdh(mySignedPreKeyPriv, initiatorIdentityPub);
  const dh2 = ecdh(myIdentityPriv, initiatorEphemeralPub);
  const dh3 = ecdh(mySignedPreKeyPriv, initiatorEphemeralPub);

  let dh4: ArrayBuffer | null = null;
  if (exchangePayload.opkIndex !== undefined && exchangePayload.opk) {
    const opkSecret = base64ToBytes(myBundle.oneTimePreKeys[exchangePayload.opkIndex]);
    dh4 = ecdh(opkSecret, initiatorEphemeralPub);
    const updatedBundle = { ...myBundle };
    updatedBundle.oneTimePreKeys.splice(exchangePayload.opkIndex, 1);
    setKeyBundle(JSON.stringify(updatedBundle));
  }

  const sharedSecretBase = deriveSharedSecret(dh1, dh2, dh3, dh4, initiatorEphemeralPub);

  const rootKey = sharedSecretBase.slice(0, KEY_LENGTH);
  const recvKey = sharedSecretBase.slice(KEY_LENGTH, KEY_LENGTH * 2);
  const sendKey = sharedSecretBase.slice(KEY_LENGTH * 2);

  const session: KeySession = {
    peerId, rootKey: bytesToBase64(rootKey),
    sendKey: bytesToBase64(sendKey), recvKey: bytesToBase64(recvKey),
    sendCounter: 0, recvCounter: 0, createdAt: Date.now(),
  };
  saveKeySession(peerId, session);
  return session;
}

export async function encryptMessage(plaintext: string, peerId: string): Promise<string> {
  const keySessions = getKeySessions();
  const session = keySessions[peerId];
  if (!session) throw new Error(`No key session for ${peerId}`);

  const sendKeyBytes = new Uint8Array(base64ToBytes(session.sendKey));
  const msgKey = deriveMessageKey(sendKeyBytes, session.sendCounter);
  const iv = await utils.randomBytes(12);
  const encrypted = await AES.encrypt(stringToBytes(plaintext), msgKey, iv);

  session.sendCounter += 1;
  saveKeySession(peerId, session);

  const combined = concatenateBuffers([iv, encrypted]);
  return bytesToBase64(combined);
}

export async function decryptMessage(cipherB64: string, peerId: string): Promise<string> {
  const keySessions = getKeySessions();
  const session = keySessions[peerId];
  if (!session) throw new Error(`No key session for ${peerId}`);

  const recvKeyBytes = new Uint8Array(base64ToBytes(session.recvKey));
  const msgKey = deriveMessageKey(recvKeyBytes, session.recvCounter);
  const combined = base64ToBytes(cipherB64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await AES.decrypt(ciphertext, msgKey, iv);

  session.recvCounter += 1;
  saveKeySession(peerId, session);

  return bytesToString(decrypted);
}

export async function encryptPacket(packet: MeshPacket): Promise<MeshPacket> {
  if (packet.type === MessageType.KEY_EXCHANGE || packet.type === MessageType.PING ||
      packet.type === MessageType.PONG || packet.type === MessageType.DELIVERY_ACK ||
      packet.type === MessageType.INTERCOM_AUDIO) return packet;
  if (packet.isBroadcast || packet.targetId === 'broadcast') return packet;
  const encryptedPayload = await encryptMessage(packet.payload, packet.targetId);
  return { ...packet, payload: encryptedPayload };
}

export async function decryptPacket(packet: MeshPacket, myNodeId: string): Promise<MeshPacket> {
  if (packet.type === MessageType.KEY_EXCHANGE || packet.type === MessageType.PING ||
      packet.type === MessageType.PONG || packet.type === MessageType.DELIVERY_ACK ||
      packet.type === MessageType.INTERCOM_AUDIO) return packet;
  if (packet.isBroadcast || packet.targetId === 'broadcast') return packet;
  if (packet.targetId !== myNodeId && !packet.isBroadcast) return packet;
  const decrypted = await decryptMessage(packet.payload, packet.sourceId);
  return { ...packet, payload: decrypted };
}

function deriveSharedSecret(dh1: ArrayBuffer, dh2: ArrayBuffer, dh3: ArrayBuffer, dh4: ArrayBuffer | null, ephemeralPub: Uint8Array): Uint8Array {
  const concatKeys = concatenateBuffers([dh1, dh2, dh3, ...(dh4 ? [dh4] : [])]);
  return hkdf(sha256, concatKeys, ephemeralPub, new TextEncoder().encode('KAmeshX3DH'), KEY_LENGTH * 3);
}

function deriveMessageKey(chainKey: Uint8Array, counter: number): Uint8Array {
  const counterBytes = new Uint8Array(4);
  new DataView(counterBytes.buffer).setUint32(0, counter, false);
  return hkdf(sha256, chainKey, counterBytes, new TextEncoder().encode('KAmeshMsgKey'), KEY_LENGTH);
}

function ecdh(privateKey: ArrayBuffer, publicKey: ArrayBuffer): ArrayBuffer {
  const shared = x25519.getSharedSecret(new Uint8Array(privateKey), new Uint8Array(publicKey));
  return shared.buffer.slice(0, KEY_LENGTH);
}

const BASE64_CODE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: ArrayBuffer): string {
  const uint8 = new Uint8Array(bytes);
  let result = '';
  for (let i = 0; i < uint8.length; i += 3) {
    const a = uint8[i];
    const b = i + 1 < uint8.length ? uint8[i + 1] : 0;
    const c = i + 2 < uint8.length ? uint8[i + 2] : 0;
    result += BASE64_CODE[a >> 2];
    result += BASE64_CODE[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < uint8.length) result += BASE64_CODE[((b & 15) << 2) | (c >> 6)];
    else result += '=';
    if (i + 2 < uint8.length) result += BASE64_CODE[c & 63];
    else result += '=';
  }
  return result;
}

function base64ToBytes(b64: string): ArrayBuffer {
  const sanitized = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = (sanitized.length * 3) / 4;
  const uint8 = new Uint8Array(len);
  let j = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const a = BASE64_CODE.indexOf(sanitized[i]);
    const b = BASE64_CODE.indexOf(sanitized[i + 1]);
    const c = BASE64_CODE.indexOf(sanitized[i + 2]);
    const d = BASE64_CODE.indexOf(sanitized[i + 3]);
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

function concatenateBuffers(buffers: ArrayBuffer[]): Uint8Array {
  const totalLen = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result;
}
