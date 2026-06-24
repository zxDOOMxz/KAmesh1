import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { MeshService } from './MeshService';
import { getNodeId, getJson, setJson, deleteKey, containsKey } from './StorageService';
import { MeshPacket, MessageType, NodeId, UpdateManifest, UpdateChunk, UpdateChunkRequest, ChangelogEntry } from '../types';
import { UPDATE_CHUNK_SIZE, UPDATE_CHANGELOG_KEY, UPDATE_FLAG_KEY, APP_VERSION, APP_VERSION_CODE, UPDATE_APK_FILENAME } from '../constants';

interface DownloadState {
  manifest: UpdateManifest;
  chunks: Map<number, string>;
  receivedIndices: Set<number>;
  seeders: Set<NodeId>;
  startedAt: number;
}

type UpdateListener = (event: UpdateEvent) => void;

interface UpdateEvent {
  type: 'progress' | 'complete' | 'error' | 'manifest_received';
  progress?: number;
  version?: string;
  changelog?: string[];
  error?: string;
}

class UpdateServiceClass {
  private initialized = false;
  private currentVersion = APP_VERSION;
  private currentVersionCode = APP_VERSION_CODE;
  private pendingChangelog: ChangelogEntry | null = null;
  private activeDownload: DownloadState | null = null;
  private myNodeId: NodeId = '';
  private listeners: UpdateListener[] = [];
  private localManifest: UpdateManifest | null = null;
  private localApkBase64: string | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.myNodeId = getNodeId() || '';
    this.pendingChangelog = getJson<ChangelogEntry>(UPDATE_CHANGELOG_KEY);
    if (this.pendingChangelog) deleteKey(UPDATE_CHANGELOG_KEY);
    if (containsKey(UPDATE_FLAG_KEY)) deleteKey(UPDATE_FLAG_KEY);
    MeshService.onPacket(this.handleMeshPacket.bind(this));
    this.initialized = true;
  }

  getPendingChangelog(): ChangelogEntry | null { return this.pendingChangelog; }
  dismissChangelog(): void { this.pendingChangelog = null; }

  async registerUpdate(apkPath: string, version: string, versionCode: number, changelog: string[], downloadUrl?: string): Promise<void> {
    const fileInfo = await FileSystem.getInfoAsync(apkPath);
    if (!fileInfo.exists || !fileInfo.size) throw new Error('APK not found');
    this.localApkBase64 = await FileSystem.readAsStringAsync(apkPath, { encoding: FileSystem.EncodingType.Base64 });
    const chunkSizeB64 = Math.ceil(UPDATE_CHUNK_SIZE * 4 / 3);
    const totalChunks = Math.ceil(this.localApkBase64.length / chunkSizeB64);
    const fileHash = this.computeHashBase64(this.localApkBase64);
    this.localManifest = { version, versionCode, totalSize: fileInfo.size, chunkSize: UPDATE_CHUNK_SIZE, totalChunks, fileHash, changelog, timestamp: Date.now(), senderId: this.myNodeId, packageName: 'com.mash.offline', downloadUrl };
  }

  async broadcastManifest(): Promise<void> {
    if (!this.localManifest) throw new Error('Call registerUpdate first');
    await MeshService.sendMessage(MessageType.UPDATE_MANIFEST, JSON.stringify(this.localManifest), 'broadcast');
  }

  onEvent(handler: UpdateListener): () => void { this.listeners.push(handler); return () => { this.listeners = this.listeners.filter(h => h !== handler); }; }
  getDownloadProgress(): number | null { if (!this.activeDownload) return null; return Math.round((this.activeDownload.receivedIndices.size / this.activeDownload.manifest.totalChunks) * 100); }
  isDownloading(): boolean { return this.activeDownload !== null; }
  getCurrentVersion(): string { return this.currentVersion; }
  getCurrentVersionCode(): number { return this.currentVersionCode; }

  private async handleMeshPacket(packet: MeshPacket, relayId: NodeId): Promise<void> {
    switch (packet.type) {
      case MessageType.UPDATE_MANIFEST: await this.handleManifestReceived(packet); break;
      case MessageType.UPDATE_CHUNK_REQUEST: await this.handleChunkRequest(packet, relayId); break;
      case MessageType.UPDATE_CHUNK: await this.handleChunkReceived(packet); break;
    }
  }

  private async handleManifestReceived(packet: MeshPacket): Promise<void> {
    try {
      const manifest: UpdateManifest = JSON.parse(packet.payload);
      if (manifest.packageName !== 'com.mash.offline' || manifest.versionCode <= this.currentVersionCode) return;
      if (this.activeDownload?.manifest.versionCode === manifest.versionCode) return;

      this.notifyListeners({ type: 'manifest_received', version: manifest.version, changelog: manifest.changelog });
      this.activeDownload = { manifest, chunks: new Map(), receivedIndices: new Set(), seeders: new Set([manifest.senderId]), startedAt: Date.now() };

      if (manifest.downloadUrl) {
        const success = await this.downloadFromInternet(manifest);
        if (success) return;
      }
      await this.requestNextChunks();
    } catch { /* ignore */ }
  }

  private async downloadFromInternet(manifest: UpdateManifest): Promise<boolean> {
    if (!manifest.downloadUrl) return false;
    try {
      const dest = `${FileSystem.cacheDirectory}${UPDATE_APK_FILENAME}`;
      const result = await FileSystem.downloadAsync(manifest.downloadUrl, dest);
      const downloadedBase64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
      if (this.computeHashBase64(downloadedBase64) !== manifest.fileHash) throw new Error('Hash mismatch');
      await this.installUpdate(result.uri, manifest);
      return true;
    } catch { return false; }
  }

  private async requestNextChunks(): Promise<void> {
    if (!this.activeDownload) return;
    const { manifest, receivedIndices, seeders } = this.activeDownload;
    const missing: number[] = [];
    for (let i = 0; i < manifest.totalChunks; i++) { if (!receivedIndices.has(i)) missing.push(i); }
    if (missing.length === 0) { await this.finalizeDownload(); return; }

    const batchSize = 5;
    for (const seederId of seeders) {
      if (missing.length === 0) break;
      const fromIdx = missing[0];
      const toIdx = Math.min(fromIdx + batchSize - 1, manifest.totalChunks - 1);
      await MeshService.sendMessage(MessageType.UPDATE_CHUNK_REQUEST, JSON.stringify({ manifestVersionCode: manifest.versionCode, fromIndex: fromIdx, toIndex: toIdx, requesterId: this.myNodeId } as UpdateChunkRequest), seederId);
      for (let i = fromIdx; i <= toIdx; i++) { const idx = missing.indexOf(i); if (idx !== -1) missing.splice(idx, 1); }
    }
    this.notifyListeners({ type: 'progress', progress: this.getDownloadProgress() ?? 0 });
  }

  private async handleChunkRequest(packet: MeshPacket, relayId: NodeId): Promise<void> {
    try {
      if (!this.localManifest || !this.localApkBase64) return;
      const request: UpdateChunkRequest = JSON.parse(packet.payload);
      if (request.manifestVersionCode !== this.localManifest.versionCode) return;
      const chunkSizeB64 = Math.ceil(UPDATE_CHUNK_SIZE * 4 / 3);
      for (let i = request.fromIndex; i <= request.toIndex && i < this.localManifest.totalChunks; i++) {
        const b64Start = i * chunkSizeB64;
        const b64End = Math.min(b64Start + chunkSizeB64, this.localApkBase64.length);
        await MeshService.sendMessage(MessageType.UPDATE_CHUNK, JSON.stringify({ manifestVersionCode: request.manifestVersionCode, chunkIndex: i, data: this.localApkBase64.slice(b64Start, b64End), totalChunks: this.localManifest.totalChunks, senderId: this.myNodeId } as UpdateChunk), request.requesterId);
      }
    } catch { /* ignore */ }
  }

  private async handleChunkReceived(packet: MeshPacket): Promise<void> {
    try {
      if (!this.activeDownload) return;
      const chunk: UpdateChunk = JSON.parse(packet.payload);
      if (chunk.manifestVersionCode !== this.activeDownload.manifest.versionCode) return;
      if (this.activeDownload.receivedIndices.has(chunk.chunkIndex)) return;
      this.activeDownload.chunks.set(chunk.chunkIndex, chunk.data);
      this.activeDownload.receivedIndices.add(chunk.chunkIndex);
      this.activeDownload.seeders.add(chunk.senderId);
      const progress = this.getDownloadProgress() ?? 0;
      this.notifyListeners({ type: 'progress', progress });
      if (this.activeDownload.receivedIndices.size >= this.activeDownload.manifest.totalChunks) await this.finalizeDownload();
      else await this.requestNextChunks();
    } catch { /* ignore */ }
  }

  private async finalizeDownload(): Promise<void> {
    if (!this.activeDownload) return;
    const { manifest, chunks } = this.activeDownload;
    try {
      let fullBase64 = '';
      for (let i = 0; i < manifest.totalChunks; i++) {
        const chunk = chunks.get(i);
        if (!chunk) throw new Error(`Missing chunk ${i}`);
        fullBase64 += chunk;
      }
      if (this.computeHashBase64(fullBase64) !== manifest.fileHash) throw new Error('Hash mismatch');
      const apkPath = `${FileSystem.cacheDirectory}${UPDATE_APK_FILENAME}`;
      await FileSystem.writeAsStringAsync(apkPath, fullBase64, { encoding: FileSystem.EncodingType.Base64 });
      setJson(UPDATE_CHANGELOG_KEY, { version: manifest.version, versionCode: manifest.versionCode, changelog: manifest.changelog, installedAt: Date.now() } as ChangelogEntry);
      await this.installUpdate(apkPath, manifest);
      this.notifyListeners({ type: 'complete', version: manifest.version, changelog: manifest.changelog });
    } catch (err) {
      this.notifyListeners({ type: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
      this.activeDownload = null;
    }
  }

  private async installUpdate(apkPath: string, manifest: UpdateManifest): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      const contentUri = await FileSystem.getContentUriAsync(apkPath);
      await Linking.openURL(contentUri);
      this.activeDownload = null;
    } catch { throw new Error('Install failed'); }
  }

  private computeHashBase64(base64Data: string): string {
    try {
      const sanitized = base64Data.replace(/[^A-Za-z0-9+/]/g, '');
      const len = Math.floor((sanitized.length * 3) / 4);
      const uint8 = new Uint8Array(len);
      let j = 0;
      const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      for (let i = 0; i < sanitized.length; i += 4) {
        const a = table.indexOf(sanitized[i]), b = table.indexOf(sanitized[i + 1]);
        const c = table.indexOf(sanitized[i + 2]), d = table.indexOf(sanitized[i + 3]);
        uint8[j++] = (a << 2) | (b >> 4);
        if (c !== -1) uint8[j++] = ((b & 15) << 4) | (c >> 2);
        if (d !== -1) uint8[j++] = ((c & 3) << 6) | d;
      }
      const hashBytes = sha256(uint8.slice(0, j));
      return bytesToHex(hashBytes);
    } catch { return 'hash_error'; }
  }

  private notifyListeners(event: UpdateEvent): void { for (const handler of this.listeners) { try { handler(event); } catch { /* ignore */ } } }
  isInitialized(): boolean { return this.initialized; }
}

export const UpdateService = new UpdateServiceClass();
