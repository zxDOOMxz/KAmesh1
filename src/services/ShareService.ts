import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { MeshService } from './MeshService';
import { ContactService } from './ContactService';
import { getNodeId } from './StorageService';
import { MeshPacket, MessageType, NodeId } from '../types';
import { UPDATE_CHUNK_SIZE, UPDATE_APK_FILENAME } from '../constants';

export type ShareEvent = { type: 'request_received'; fromPeer: NodeId; fromNickname: string } | { type: 'accepted'; toPeer: NodeId } | { type: 'rejected'; toPeer: NodeId } | { type: 'progress'; progress: number } | { type: 'complete' } | { type: 'error'; error: string } | { type: 'chunk_received'; progress: number } | { type: 'transfer_complete' } | { type: 'ready_for_install' };

type ShareListener = (event: ShareEvent) => void;

interface TransferState {
  peerId: NodeId;
  direction: 'send' | 'receive';
  apkBase64: string;
  totalChunks: number;
  receivedChunks: Map<number, string>;
  receivedIndices: Set<number>;
  startedAt: number;
  sessionId: string;
}

class ShareServiceClass {
  private myNodeId: NodeId = '';
  private initialized = false;
  private listeners: ShareListener[] = [];
  private activeTransfer: TransferState | null = null;
  private localApkBase64: string | null = null;
  private localApkSize: number = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.myNodeId = getNodeId() || '';
    MeshService.onPacket(this.handlePacket.bind(this));
    this.initialized = true;
  }

  async registerLocalApk(): Promise<boolean> {
    try {
      const otaPath = `${FileSystem.cacheDirectory}${UPDATE_APK_FILENAME}`;
      const otaInfo = await FileSystem.getInfoAsync(otaPath);
      if (otaInfo.exists && otaInfo.size && otaInfo.size > 0) {
        this.localApkBase64 = await FileSystem.readAsStringAsync(otaPath, { encoding: FileSystem.EncodingType.Base64 });
        this.localApkSize = this.localApkBase64.length;
        return true;
      }
      return false;
    } catch { return false; }
  }

  async registerApkFromPath(apkPath: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(apkPath);
      if (!info.exists || !info.size) return false;
      this.localApkBase64 = await FileSystem.readAsStringAsync(apkPath, { encoding: FileSystem.EncodingType.Base64 });
      this.localApkSize = this.localApkBase64.length;
      return true;
    } catch { return false; }
  }

  hasRegisteredApk(): boolean { return this.localApkBase64 !== null; }

  async sendApk(peerId: NodeId): Promise<void> {
    if (!this.localApkBase64) {
      const registered = await this.registerLocalApk();
      if (!registered) { this.notifyListeners({ type: 'error', error: 'APK not found' }); return; }
    }
    const sessionId = `share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chunkSizeB64 = Math.ceil(UPDATE_CHUNK_SIZE * 4 / 3);
    const totalChunks = Math.ceil(this.localApkSize / chunkSizeB64);
    await MeshService.sendMessage(MessageType.SHARE_APK_REQUEST, JSON.stringify({ sessionId, totalSize: this.localApkSize, totalChunks, chunkSize: UPDATE_CHUNK_SIZE, senderNickname: ContactService.getMyNickname() || this.myNodeId.slice(0, 8) }), peerId);
    this.activeTransfer = { peerId, direction: 'send', apkBase64: this.localApkBase64!, totalChunks, receivedChunks: new Map(), receivedIndices: new Set(), startedAt: Date.now(), sessionId };
  }

  private async handlePacket(packet: MeshPacket): Promise<void> {
    switch (packet.type) {
      case MessageType.SHARE_APK_REQUEST: await this.handleRequest(packet); break;
      case MessageType.SHARE_APK_ACCEPT: await this.handleAccept(packet); break;
      case MessageType.SHARE_APK_REJECT: await this.handleReject(packet); break;
      case MessageType.SHARE_APK_CHUNK: await this.handleChunk(packet); break;
      case MessageType.SHARE_APK_DONE: await this.handleDone(packet); break;
    }
  }

  private async handleRequest(packet: MeshPacket): Promise<void> {
    try {
      const data = JSON.parse(packet.payload);
      const senderNickname = data.senderNickname || packet.sourceId.slice(0, 8);
      this.activeTransfer = { peerId: packet.sourceId, direction: 'receive', apkBase64: '', totalChunks: data.totalChunks, receivedChunks: new Map(), receivedIndices: new Set(), startedAt: Date.now(), sessionId: data.sessionId };
      this.notifyListeners({ type: 'request_received', fromPeer: packet.sourceId, fromNickname: senderNickname });
    } catch { /* ignore */ }
  }

  async acceptIncoming(accept: boolean): Promise<void> {
    if (!this.activeTransfer || this.activeTransfer.direction !== 'receive') return;
    const peerId = this.activeTransfer.peerId;
    if (accept) { await MeshService.sendMessage(MessageType.SHARE_APK_ACCEPT, JSON.stringify({ accepted: true, sessionId: this.activeTransfer.sessionId }), peerId); }
    else { await MeshService.sendMessage(MessageType.SHARE_APK_REJECT, JSON.stringify({ accepted: false }), peerId); this.activeTransfer = null; }
  }

  private async handleAccept(packet: MeshPacket): Promise<void> {
    if (!this.activeTransfer || this.activeTransfer.direction !== 'send') return;
    this.notifyListeners({ type: 'accepted', toPeer: packet.sourceId });
    await this.sendNextChunks(0);
  }

  private async handleReject(packet: MeshPacket): Promise<void> {
    if (!this.activeTransfer || this.activeTransfer.direction !== 'send') return;
    this.notifyListeners({ type: 'rejected', toPeer: packet.sourceId });
    this.activeTransfer = null;
  }

  private async sendNextChunks(fromIndex: number): Promise<void> {
    if (!this.activeTransfer || this.activeTransfer.direction !== 'send') return;
    const { apkBase64, totalChunks, peerId, sessionId } = this.activeTransfer;
    const chunkSizeB64 = Math.ceil(UPDATE_CHUNK_SIZE * 4 / 3);
    const batchSize = 5;
    const endIndex = Math.min(fromIndex + batchSize, totalChunks);

    for (let i = fromIndex; i < endIndex; i++) {
      const b64Start = i * chunkSizeB64;
      const b64End = Math.min(b64Start + chunkSizeB64, apkBase64.length);
      await MeshService.sendMessage(MessageType.SHARE_APK_CHUNK, JSON.stringify({ sessionId, chunkIndex: i, data: apkBase64.slice(b64Start, b64End), totalChunks, totalSize: apkBase64.length }), peerId);
    }
    const progress = Math.round((endIndex / totalChunks) * 100);
    this.notifyListeners({ type: 'progress', progress });

    if (endIndex >= totalChunks) {
      await MeshService.sendMessage(MessageType.SHARE_APK_DONE, JSON.stringify({ sessionId, totalChunks }), peerId);
      this.notifyListeners({ type: 'complete' });
      this.activeTransfer = null;
    } else { setTimeout(() => this.sendNextChunks(endIndex), 100); }
  }

  private async handleChunk(packet: MeshPacket): Promise<void> {
    if (!this.activeTransfer || this.activeTransfer.direction !== 'receive') return;
    try {
      const chunk = JSON.parse(packet.payload);
      if (chunk.sessionId !== this.activeTransfer.sessionId || this.activeTransfer.receivedIndices.has(chunk.chunkIndex)) return;
      this.activeTransfer.receivedChunks.set(chunk.chunkIndex, chunk.data);
      this.activeTransfer.receivedIndices.add(chunk.chunkIndex);
      this.notifyListeners({ type: 'chunk_received', progress: Math.round((this.activeTransfer.receivedIndices.size / this.activeTransfer.totalChunks) * 100) });
    } catch { /* ignore */ }
  }

  private async handleDone(packet: MeshPacket): Promise<void> {
    if (!this.activeTransfer || this.activeTransfer.direction !== 'receive') return;
    try {
      let fullBase64 = '';
      for (let i = 0; i < this.activeTransfer.totalChunks; i++) {
        const chunk = this.activeTransfer.receivedChunks.get(i);
        if (!chunk) throw new Error(`Missing chunk ${i}`);
        fullBase64 += chunk;
      }
      const apkPath = `${FileSystem.cacheDirectory}${UPDATE_APK_FILENAME}`;
      await FileSystem.writeAsStringAsync(apkPath, fullBase64, { encoding: FileSystem.EncodingType.Base64 });
      this.notifyListeners({ type: 'transfer_complete' });
      this.notifyListeners({ type: 'ready_for_install' });
      this.activeTransfer = null;
    } catch (err) {
      this.notifyListeners({ type: 'error', error: err instanceof Error ? err.message : 'Assembly error' });
      this.activeTransfer = null;
    }
  }

  async installReceivedApk(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      const contentUri = await FileSystem.getContentUriAsync(`${FileSystem.cacheDirectory}${UPDATE_APK_FILENAME}`);
      await Linking.openURL(contentUri);
    } catch { /* ignore */ }
  }

  getActiveTransfer(): TransferState | null { return this.activeTransfer; }
  isSending(): boolean { return this.activeTransfer !== null && this.activeTransfer.direction === 'send'; }
  isReceiving(): boolean { return this.activeTransfer !== null && this.activeTransfer.direction === 'receive'; }

  onEvent(handler: ShareListener): () => void { this.listeners.push(handler); return () => { this.listeners = this.listeners.filter(h => h !== handler); }; }
  private notifyListeners(event: ShareEvent): void { for (const handler of this.listeners) { try { handler(event); } catch { /* ignore */ } } }
  isInitialized(): boolean { return this.initialized; }
}

export const ShareService = new ShareServiceClass();
