import { P2PBridge } from '../../native/P2PBridge';
import { CryptoBridge, hexToBytes } from '../../native/CryptoBridge';
import type { Store, MessageRecord } from '../../storage/Store';
import { decodeUtf8 } from '../../utils/decodeUtf8';

let _id = 0;
function uid() { return `${Date.now().toString(36)}_${(++_id).toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }

export interface P2PState {
  peerId: string;
  serverInfo: { serverId: string; localIp: string; port: number } | null;
  connectedPeers: Map<string, { host: string; port: number; peerKey: string }>;
  messages: MessageRecord[];
  status: 'idle' | 'starting' | 'running' | 'error';
}

export type StateListener = (state: P2PState) => void;

let _instance: P2PMessenger | null = null;

export class P2PMessenger {
  private p2p: P2PBridge;
  private crypto: CryptoBridge;
  private store: Store;
  private state: P2PState;
  private listeners: Set<StateListener> = new Set();
  private cleanupFns: (() => void)[] = [];
  private peerKeys: Map<string, string> = new Map();

  constructor(store: Store) {
    this.p2p = new P2PBridge();
    this.crypto = new CryptoBridge();
    this.store = store;
    this.state = { peerId: '', serverInfo: null, connectedPeers: new Map(), messages: [], status: 'idle' };
  }

  static getInstance(store: Store): P2PMessenger {
    if (!_instance) { _instance = new P2PMessenger(store); }
    return _instance;
  }

  getState(): P2PState {
    return { ...this.state, connectedPeers: new Map(this.state.connectedPeers), messages: [...this.state.messages] };
  }

  subscribe(cb: StateListener): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  async init(): Promise<void> {
    if (this.state.status === 'running') { return; }
    this.state = { ...this.state, status: 'starting' };
    this.notify();
    try {
      const peerId = await this.p2p.init();
      const unsubMsg = this.p2p.onMessage(async (event) => {
        try {
          const raw = event.data.startsWith('MSG:') ? event.data.slice(4).trim() : event.data.trim();
          if (raw.startsWith('HANDSHAKE:')) {
            const pk = raw.slice(10).trim();
            this.peerKeys.set(event.connectionId, pk);
            this.p2p.sendMessage(event.connectionId, JSON.stringify({ type: 'handshake_info', publicKey: this.state.peerId }));
            return;
          }
          const parsed = JSON.parse(raw);
          if (parsed.type === 'encrypted_msg') {
            const peerKey = this.peerKeys.get(event.connectionId) || parsed.senderPeerId || this.state.peerId;
            const sharedKey = await this.deriveSharedKey(peerKey);
            const ciphertext = hexToBytes(parsed.ciphertext);
            const nonce = hexToBytes(parsed.nonce);
            const plaintext = await this.crypto.decrypt(ciphertext, sharedKey, nonce);
            const record: MessageRecord = {
              id: uid(), channelId: parsed.channelId || 'default',
              senderPeerId: parsed.senderPeerId || event.connectionId,
              ciphertext: plaintext, nonce, createdAt: Date.now(),
              expiresAt: Date.now() + 86400000 * 7, sizeBytes: plaintext.length,
            };
            await this.store.saveMessage(record);
            this.state.messages.unshift(record);
            if (this.state.messages.length > 100) { this.state.messages.length = 100; }
            this.notify();
          } else if (parsed.type === 'handshake_info') {
            this.peerKeys.set(event.connectionId, parsed.publicKey);
          } else if (parsed.type === 'friend_request') {
            this.friendRequestListeners.forEach((cb) => { try { cb({ from: parsed.from, connectionId: event.connectionId }); } catch {} });
          }
        } catch { /* skip unparseable */ }
      });
      this.cleanupFns.push(unsubMsg);
      this.state = { ...this.state, peerId, status: 'running' };
      this.notify();
    } catch (e) {
      this.setState({ status: 'error' });
      throw e;
    }
  }

  getDecrypted(record: MessageRecord): string {
    return decodeUtf8(record.ciphertext);
  }

  private friendRequestListeners: Set<(ev: { from: string; connectionId: string }) => void> = new Set();

  async startServer(port = 0): Promise<void> {
    const info = await this.p2p.startServer(port);
    this.setState({ serverInfo: info });
  }

  async startDiscovery(nickname: string): Promise<void> {
    await this.p2p.startDiscovery(nickname);
  }

  onPeerDiscovered(cb: (event: { peerId: string; nickname: string; host: string; port: number }) => void): () => void {
    return this.p2p.onPeerDiscovered(cb);
  }

  onFriendRequest(cb: (ev: { from: string; connectionId: string }) => void): () => void {
    this.friendRequestListeners.add(cb);
    return () => { this.friendRequestListeners.delete(cb); };
  }

  async connect(host: string, port: number): Promise<string> {
    const connId = await this.p2p.connect(host, port);
    this.state.connectedPeers.set(connId, { host, port, peerKey: '' });
    this.notify();
    this.p2p.sendMessage(connId, JSON.stringify({ type: 'handshake_info', publicKey: this.state.peerId }));
    return connId;
  }

  async sendMessage(text: string, connId: string, channelId = 'default'): Promise<void> {
    const peerKey = this.peerKeys.get(connId) || this.state.peerId;
    const sharedKey = await this.deriveSharedKey(peerKey);
    const nonce = await this.crypto.generateNonce();
    const plaintext = new TextEncoder().encode(text);
    const ciphertext = await this.crypto.encrypt(plaintext, sharedKey, nonce);
    const payload = JSON.stringify({
      type: 'encrypted_msg',
      ciphertext: bytesToHex(ciphertext),
      nonce: bytesToHex(nonce),
      senderPeerId: this.state.peerId,
      channelId,
    });
    await this.p2p.sendMessage(connId, payload);
    const record: MessageRecord = {
      id: uid(), channelId, senderPeerId: this.state.peerId,
      ciphertext: plaintext, nonce, createdAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 7, sizeBytes: plaintext.length,
    };
    await this.store.saveMessage(record);
    this.state.messages.unshift(record);
    if (this.state.messages.length > 100) { this.state.messages.length = 100; }
    this.notify();
  }

  async disconnect(connId: string): Promise<void> {
    this.p2p.disconnect(connId);
    this.state.connectedPeers.delete(connId);
    this.peerKeys.delete(connId);
    this.notify();
  }

  async destroy(): Promise<void> {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    this.p2p.stopAll();
    this.peerKeys.clear();
    this.setState({ peerId: '', serverInfo: null, connectedPeers: new Map(), messages: [], status: 'idle' });
  }

  private async deriveSharedKey(peerPubKey: string): Promise<Uint8Array> {
    const material = (this.state.peerId || '') + peerPubKey;
    const hash = await this.crypto.sha256(new TextEncoder().encode(material));
    return hash.slice(0, 32);
  }

  private setState(partial: Partial<P2PState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify(): void {
    const snap = this.getState();
    this.listeners.forEach((cb) => { try { cb(snap); } catch {} });
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
